#!/usr/bin/env npx tsx
/**
 * Backfill document_chunks.embedding_v2 (bge-m3 / 1024) via batched Ollama /api/embed.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (trimmed), EMBED_BACKFILL_URL (required),
 *      optional EMBED_QUERY_URL (chat instance detection).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LatencyBackoff, effectiveMaxBatchesPerMinute, shouldSleepForBatchRate } from '../lib/backfill-embedding-v2/busy-pause';
import { buildSaveRows, fetchEmbedBatch, type EmbedRow } from '../lib/backfill-embedding-v2/embed-batch';
import { loadScheduleWindows, parseBackfillArgv } from '../lib/backfill-embedding-v2/parse-args';
import {
  maxBatchesPerMinuteForSchedule,
  scheduleModeAt,
} from '../lib/backfill-embedding-v2/schedule';
import { checkEmbedUrlsAtStartup } from '../lib/backfill-embedding-v2/urls';
import { existsSync } from 'node:fs';

const FAST_LANE_POLL_MS = 60_000;

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

type PriorityIssue = { issue_id: string; pending_chunks: number };

async function main(): Promise<void> {
  const cli = parseBackfillArgv(process.argv.slice(2));
  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const embedBackfillUrl = requiredEnv('EMBED_BACKFILL_URL');
  const embedQueryUrl = process.env.EMBED_QUERY_URL?.trim();

  const urlCheck = checkEmbedUrlsAtStartup(
    embedBackfillUrl,
    embedQueryUrl,
    cli.allowGpu,
    cli.busyPause,
  );
  for (const warning of urlCheck.warnings) {
    console.warn(`[backfill-v2] ${warning}`);
  }
  const busyPauseEnabled = urlCheck.busyPauseDefault;

  const scheduleWindows = loadScheduleWindows(cli);
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const latency = new LatencyBackoff(cli.busyLatencyMs);
  let batchesThisMinute = 0;
  let minuteStarted = Date.now();

  console.log(
    JSON.stringify({
      workers: cli.workers,
      workerIndex: cli.workerIndex,
      batch: cli.batch,
      dryRun: cli.dryRun,
      busyPause: busyPauseEnabled,
      schedule: cli.schedule,
    }),
  );

  while (true) {
    if (cli.stopFile && existsSync(cli.stopFile)) {
      console.log('[backfill-v2] stop-file funnet — avslutter.');
      break;
    }

    const now = Date.now();
    if (now - minuteStarted >= 60_000) {
      batchesThisMinute = 0;
      minuteStarted = now;
    }

    const scheduleMode = scheduleModeAt(scheduleWindows, new Date(), cli.scheduleTimeZone);
    const scheduleCap = maxBatchesPerMinuteForSchedule(
      scheduleMode,
      cli.maxBatchesPerMin,
      cli.fullMaxBatchesPerMin,
    );

    const { data: pressure, error: pressureError } = await supabase.rpc('n8n_backfill_db_pressure');
    if (pressureError) {
      console.warn(`[backfill-v2] db pressure RPC feilet: ${pressureError.message}`);
    } else if (pressure?.pause_recommended) {
      console.warn('[backfill-v2] DB pause anbefalt (WAL/slot) — venter 60s');
      await sleep(60_000);
      continue;
    }

    const tier0 = await listIssues(supabase, 0, cli);
    const tier0Pending = tier0.length > 0;

    let didWork = false;

    if (cli.tiers.includes(0) && tier0.length > 0) {
      const cap = effectiveMaxBatchesPerMinute({
        tier0Pending: true,
        lane: 'fast',
        scheduleMode,
        busyPauseEnabled,
        latencyPaused: latency.isPaused(),
        maxBatchesPerMin: scheduleCap,
        fastLaneMinBatchesPerMin: cli.fastLaneMinBatchesPerMin,
      });
      if (shouldSleepForBatchRate(batchesThisMinute, cap)) {
        await sleep(1000);
      } else {
        const issue = tier0[0];
        didWork = await drainIssue(
          supabase,
          issue.issue_id,
          cli,
          embedBackfillUrl,
          latency,
          busyPauseEnabled,
          urlCheck.chatInstance,
        );
        if (didWork) batchesThisMinute += 1;
      }
    } else if (!tier0Pending) {
      for (const tier of cli.tiers.filter((t) => t > 0)) {
        const issues = await listIssues(supabase, tier, cli);
        if (issues.length === 0) continue;
        const cap = effectiveMaxBatchesPerMinute({
          tier0Pending: false,
          lane: 'background',
          scheduleMode,
          busyPauseEnabled,
          latencyPaused: latency.isPaused(),
          maxBatchesPerMin: scheduleCap,
          fastLaneMinBatchesPerMin: cli.fastLaneMinBatchesPerMin,
        });
        if (shouldSleepForBatchRate(batchesThisMinute, cap)) {
          break;
        }
        didWork = await drainIssue(
          supabase,
          issues[0].issue_id,
          cli,
          embedBackfillUrl,
          latency,
          busyPauseEnabled,
          urlCheck.chatInstance,
        );
        if (didWork) {
          batchesThisMinute += 1;
          break;
        }
      }
    }

    if (!didWork) {
      await sleep(tier0Pending ? FAST_LANE_POLL_MS : 5000);
    }
  }
}

async function listIssues(
  supabase: SupabaseClient,
  tier: number,
  cli: ReturnType<typeof parseBackfillArgv>,
): Promise<PriorityIssue[]> {
  const { data, error } = await supabase.rpc('n8n_list_v2_priority_issues', {
    p_tier: tier,
    p_limit: 10,
    p_worker_index: cli.workerIndex,
    p_worker_count: cli.workers,
  });
  if (error) {
    throw new Error(`n8n_list_v2_priority_issues: ${error.message}`);
  }
  return (data ?? []) as PriorityIssue[];
}

async function drainIssue(
  supabase: SupabaseClient,
  issueId: string,
  cli: ReturnType<typeof parseBackfillArgv>,
  embedUrl: string,
  latency: LatencyBackoff,
  busyPauseEnabled: boolean,
  chatInstance: boolean,
): Promise<boolean> {
  const { data: chunks, error } = await supabase.rpc('n8n_list_chunks_missing_v2_for_issue', {
    p_issue_id: issueId,
    p_limit: cli.batch,
  });
  if (error) {
    throw new Error(`n8n_list_chunks_missing_v2_for_issue: ${error.message}`);
  }
  const rows = (chunks ?? []) as { id: string; content: string }[];
  if (rows.length === 0) {
    return false;
  }

  const embedRows: EmbedRow[] = rows.map((r) => ({ id: r.id, content: r.content }));
  if (cli.dryRun) {
    console.log(`[dry-run] ville embedet ${embedRows.length} chunks for ${issueId}`);
    return true;
  }

  const probe =
    cli.probeBeforeBatch || (busyPauseEnabled && chatInstance) ? '·' : null;

  const { vectors, latencyMs } = await fetchEmbedBatch(embedUrl, embedRows, {
    probeText: probe,
  });
  latency.record(latencyMs);

  const savePayload = buildSaveRows(embedRows, vectors);
  const { data: saveResult, error: saveError } = await supabase.rpc('save_embeddings_v2', {
    p_rows: savePayload,
    p_model: 'bge-m3',
    p_force: false,
  });
  if (saveError) {
    throw new Error(`save_embeddings_v2: ${saveError.message}`);
  }

  console.log(
    JSON.stringify({
      issueId,
      saved: saveResult?.saved ?? null,
      skipped: saveResult?.skipped ?? null,
      latencyMs,
      latencyPaused: latency.isPaused(),
    }),
  );
  return true;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
