import type { BackfillSupabase } from './supabase-client';
import {
  LatencyBackoff,
  effectiveMaxBatchesPerMinute,
  shouldSleepForBatchRate,
} from './busy-pause';
import type { ResolvedEndpoint } from './endpoints';
import { EndpointHealth } from './endpoint-health';
import { buildSaveRows, type EmbedRow } from './embed-batch';
import { fetchEmbedBatchForEndpoint } from './embed-provider';
import { inferModelTagFromApiModel } from './lmstudio';
import { selectClaimLane } from './lane-routing';
import { resolveEmbeddingV2ModelTag } from './provider';
import type { SharedDbPressure } from './shared-pressure';
import { maxBatchesPerMinuteForSchedule, scheduleModeAt } from './schedule';
import type { ScheduleWindow } from './schedule';
import { checkEmbedUrlsAtStartup } from './urls';
import { safeErrorMessage, collectEndpointSecrets } from './secrets';

export type ClaimedChunk = {
  id: string;
  content: string;
  chunk_index: number;
  issue_id: string;
};

export type WorkerDeps = {
  supabase: BackfillSupabase;
  endpoint: ResolvedEndpoint;
  workerId: string;
  leaseSeconds: number;
  dryRun: boolean;
  shared: SharedDbPressure;
  health: EndpointHealth;
  scheduleWindows: ScheduleWindow[];
  scheduleTimeZone: string;
  maxBatchesPerMin: number;
  fullMaxBatchesPerMin: number;
  fastLaneMinBatchesPerMin: number;
  busyLatencyMs: number;
  busyPauseFlag: boolean | undefined;
  embedQueryUrl?: string;
  allowGpu: boolean;
  probeBeforeBatch: boolean;
  secrets: string[];
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
};

export function buildWorkerId(endpointName: string): string {
  return `${endpointName}@${process.pid}`;
}

export async function runEndpointWorkerLoop(
  deps: WorkerDeps,
  shouldStop: () => boolean,
): Promise<void> {
  const urlCheck = checkEmbedUrlsAtStartup(
    deps.endpoint.url,
    deps.embedQueryUrl,
    deps.allowGpu,
    deps.busyPauseFlag,
  );
  const busyPauseEnabled = urlCheck.busyPauseDefault;
  const latency = new LatencyBackoff(deps.busyLatencyMs);
  let batchesThisMinute = 0;
  let minuteStarted = Date.now();

  while (!shouldStop()) {
    if (!deps.health.preflightOk) {
      await deps.sleep(2000);
      continue;
    }

    if (deps.shared.isPaused()) {
      await deps.sleep(1000);
      continue;
    }

    if (deps.health.isBackingOff()) {
      await deps.sleep(Math.min(deps.health.backoffRemainingMs(), 5000));
      continue;
    }

    const now = Date.now();
    if (now - minuteStarted >= 60_000) {
      batchesThisMinute = 0;
      minuteStarted = now;
    }

    const scheduleMode = scheduleModeAt(
      deps.scheduleWindows,
      new Date(),
      deps.scheduleTimeZone,
    );
    const scheduleCap = maxBatchesPerMinuteForSchedule(
      scheduleMode,
      deps.maxBatchesPerMin,
      deps.fullMaxBatchesPerMin,
    );

    const lane = selectClaimLane(deps.endpoint, deps.shared.tier0Pending);
    if (!lane) {
      await deps.sleep(deps.shared.tier0Pending ? 60_000 : 5000);
      continue;
    }

    const cap = effectiveMaxBatchesPerMinute({
      tier0Pending: deps.shared.tier0Pending,
      lane,
      scheduleMode,
      busyPauseEnabled,
      latencyPaused: latency.isPaused(),
      maxBatchesPerMin: scheduleCap,
      fastLaneMinBatchesPerMin: deps.fastLaneMinBatchesPerMin,
    });

    if (shouldSleepForBatchRate(batchesThisMinute, cap)) {
      await deps.sleep(1000);
      continue;
    }

    const { data: claimed, error: claimError } = await deps.supabase.rpc(
      'n8n_claim_chunks_missing_v2',
      {
        p_lane: lane,
        p_limit: deps.endpoint.batch,
        p_worker: deps.workerId,
        p_lease_s: deps.leaseSeconds,
      },
    );

    if (claimError) {
      deps.health.recordFailure();
      deps.log(
        `[${deps.endpoint.name}] claim feilet: ${safeErrorMessage(claimError, deps.secrets)}`,
      );
      await deps.sleep(2000);
      continue;
    }

    const rows = (claimed ?? []) as ClaimedChunk[];
    if (rows.length === 0) {
      await deps.sleep(deps.shared.tier0Pending && lane === 'fast' ? 60_000 : 5000);
      continue;
    }

    const embedRows: EmbedRow[] = rows.map((r) => ({ id: r.id, content: r.content }));

    if (deps.dryRun) {
      deps.log(`[${deps.endpoint.name}] dry-run: ${embedRows.length} chunks (${lane})`);
      batchesThisMinute += 1;
      continue;
    }

    const probe =
      deps.probeBeforeBatch || (busyPauseEnabled && urlCheck.chatInstance) ? '·' : null;

    try {
      const { vectors, latencyMs, reportedModel } = await fetchEmbedBatchForEndpoint(
        deps.endpoint,
        embedRows,
        { probeText: probe },
      );
      latency.record(latencyMs);

      const modelTag = resolveEmbeddingV2ModelTag({
        provider: deps.endpoint.provider,
        cliModelTag: deps.endpoint.modelTag,
        apiReportedModel: inferModelTagFromApiModel(reportedModel) ?? reportedModel,
      });

      const savePayload = buildSaveRows(embedRows, vectors);
      const { data: saveResult, error: saveError } = await deps.supabase.rpc(
        'save_embeddings_v2',
        {
          p_rows: savePayload,
          p_model: modelTag,
          p_force: false,
          p_worker: deps.workerId,
          p_lease_s: deps.leaseSeconds,
        },
      );

      if (saveError) {
        throw saveError;
      }

      deps.health.recordSuccess();
      batchesThisMinute += 1;
      deps.log(
        JSON.stringify({
          endpoint: deps.endpoint.name,
          lane,
          saved: saveResult?.saved ?? null,
          skipped: saveResult?.skipped ?? null,
          latencyMs,
          modelTag,
        }),
      );
    } catch (err) {
      deps.health.recordFailure();
      deps.log(
        `[${deps.endpoint.name}] batch feilet: ${safeErrorMessage(err, deps.secrets)}`,
      );
      await deps.sleep(2000);
    }
  }
}

export async function releaseWorkerClaims(
  supabase: BackfillSupabase,
  workerId: string,
): Promise<void> {
  await supabase.rpc('n8n_release_embedding_v2_claims', { p_worker: workerId });
}

export function endpointSecrets(endpoints: ResolvedEndpoint[]): string[] {
  return collectEndpointSecrets(endpoints);
}
