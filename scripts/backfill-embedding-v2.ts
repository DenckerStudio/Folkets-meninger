#!/usr/bin/env npx tsx
/**
 * Backfill document_chunks.embedding_v2 (bge-m3 / 1024) via lease claims + multi-endpoint workers.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBED_QUERY_URL (Ollama :11435 preflight),
 *      EMBED_BACKFILL_ENDPOINTS (JSON array) or EMBED_BACKFILL_URL + EMBED_BACKFILL_PROVIDER.
 *      API keys only via apiKeyEnv per endpoint (env var name, never the secret in config).
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEndpointConfigs, finalizeEndpoints } from '../lib/backfill-embedding-v2/endpoints';
import { loadScheduleWindows, parseBackfillArgv } from '../lib/backfill-embedding-v2/parse-args';
import { runEmbeddingPreflight } from '../lib/backfill-embedding-v2/preflight';
import { SharedDbPressure } from '../lib/backfill-embedding-v2/shared-pressure';
import { EndpointHealth } from '../lib/backfill-embedding-v2/endpoint-health';
import {
  buildWorkerId,
  endpointSecrets,
  releaseWorkerClaims,
  runEndpointWorkerLoop,
} from '../lib/backfill-embedding-v2/worker';
import { safeErrorMessage } from '../lib/backfill-embedding-v2/secrets';
import { inferModelTagFromApiModel } from '../lib/backfill-embedding-v2/lmstudio';
import { resolveEmbeddingV2ModelTag } from '../lib/backfill-embedding-v2/provider';
import { fetchLmStudioEmbedVectors } from '../lib/backfill-embedding-v2/lmstudio';

function requiredEnv(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`Mangler miljøvariabel ${name}`);
  }
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tier0Probe(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const { data, error } = await supabase.rpc('n8n_list_v2_priority_issues', {
    p_tier: 0,
    p_limit: 1,
    p_worker_index: 0,
    p_worker_count: 1,
  });
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

async function runPreflightForEndpoint(
  endpoint: ReturnType<typeof finalizeEndpoints>[number],
  queryUrl: string,
  log: (line: string) => void,
): Promise<boolean> {
  try {
    const result = await runEmbeddingPreflight({
      provider: endpoint.provider,
      backfillUrl: endpoint.url,
      queryUrl,
      apiModel: endpoint.apiModel,
      apiKey: endpoint.apiKey,
      log,
    });

    let modelTag = endpoint.modelTag;
    if (endpoint.provider === 'lmstudio') {
      const probe = await fetchLmStudioEmbedVectors(endpoint.url, ['probe'], {
        apiKey: endpoint.apiKey,
        apiModel: endpoint.apiModel,
      });
      modelTag = resolveEmbeddingV2ModelTag({
        provider: 'lmstudio',
        cliModelTag: endpoint.modelTag,
        apiReportedModel:
          inferModelTagFromApiModel(probe.reportedModel) ?? probe.reportedModel,
      });
    }

    log(
      JSON.stringify({
        endpoint: endpoint.name,
        preflight: 'ok',
        minCosine: result.minCosine,
        samples: result.sampleCount,
        modelTag,
        queryModel: result.queryModelSummary,
      }),
    );
    return true;
  } catch (err) {
    log(
      `[${endpoint.name}] preflight feilet — endpoint deaktivert: ${safeErrorMessage(err, endpointSecrets([endpoint]))}`,
    );
    return false;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cli = parseBackfillArgv(argv);
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const embedQueryUrl = requiredEnv('EMBED_QUERY_URL');

  const endpointInputs = loadEndpointConfigs(argv);
  const endpoints = finalizeEndpoints(endpointInputs);
  const secrets = endpointSecrets(endpoints);
  const log = (line: string) => console.log(line);

  const scheduleWindows = loadScheduleWindows(cli);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const healthByName = new Map<string, EndpointHealth>();
  for (const ep of endpoints) {
    healthByName.set(ep.name, new EndpointHealth());
  }

  let preflightOkCount = 0;
  for (const ep of endpoints) {
    const ok = await runPreflightForEndpoint(ep, embedQueryUrl, log);
    const health = healthByName.get(ep.name)!;
    if (ok) {
      health.markPreflightPassed();
      preflightOkCount += 1;
    }
  }

  if (cli.preflightOnly) {
    process.exit(preflightOkCount > 0 ? 0 : 1);
  }

  const activeEndpoints = endpoints.filter((ep) => healthByName.get(ep.name)?.preflightOk);
  if (activeEndpoints.length === 0) {
    throw new Error('Ingen endepunkter bestod preflight');
  }

  const shared = new SharedDbPressure();
  let stopping = false;
  const workerIds: string[] = [];

  const requestStop = async () => {
    if (stopping) return;
    stopping = true;
    for (const id of workerIds) {
      await releaseWorkerClaims(supabase, id);
    }
  };

  process.on('SIGINT', () => {
    void requestStop().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void requestStop().finally(() => process.exit(0));
  });

  const coordinator = (async () => {
    while (!stopping) {
      if (cli.stopFile && existsSync(cli.stopFile)) {
        log('[backfill-v2] stop-file funnet — avslutter.');
        stopping = true;
        await requestStop();
        break;
      }
      await shared.refresh(supabase, { tier0Probe: () => tier0Probe(supabase) });
      if (shared.isPaused()) {
        log('[backfill-v2] delt DB-pause (WAL/slot) — alle workers venter');
      }
      for (const ep of activeEndpoints) {
        const health = healthByName.get(ep.name)!;
        if (health.needsPreflight) {
          const ok = await runPreflightForEndpoint(ep, embedQueryUrl, log);
          if (ok) health.markPreflightPassed();
        }
      }
      await sleep(5000);
    }
  })();

  const workers = activeEndpoints.map(async (endpoint) => {
    const workerId = buildWorkerId(endpoint.name);
    workerIds.push(workerId);
    const health = healthByName.get(endpoint.name)!;

    await runEndpointWorkerLoop(
      {
        supabase,
        endpoint,
        workerId,
        leaseSeconds: cli.leaseSeconds,
        dryRun: cli.dryRun,
        shared,
        health,
        scheduleWindows,
        scheduleTimeZone: cli.scheduleTimeZone,
        maxBatchesPerMin: cli.maxBatchesPerMin,
        fullMaxBatchesPerMin: cli.fullMaxBatchesPerMin,
        fastLaneMinBatchesPerMin: cli.fastLaneMinBatchesPerMin,
        busyLatencyMs: cli.busyLatencyMs,
        busyPauseFlag: cli.busyPause,
        embedQueryUrl,
        allowGpu: cli.allowGpu,
        probeBeforeBatch: cli.probeBeforeBatch,
        secrets,
        sleep,
        log,
      },
      () => stopping || Boolean(cli.stopFile && existsSync(cli.stopFile)),
    );
  });

  await Promise.all([coordinator, ...workers]);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
