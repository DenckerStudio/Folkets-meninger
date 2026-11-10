#!/usr/bin/env npx tsx
/**
 * Backfill document_chunks.embedding_v2 (bge-m3 / 1024) via lease claims + multi-endpoint workers.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBED_QUERY_URL (Ollama :11435 preflight),
 *      EMBED_BACKFILL_ENDPOINTS (JSON array) or EMBED_BACKFILL_URL (+ optional EMBED_BACKFILL_PROVIDER=ollama).
 *      Kun Ollama native /api/embed (bge-m3, 1024 dim). LM Studio støttes ikke lenger.
 */
import { createBackfillSupabase } from '../lib/backfill-embedding-v2/supabase-client';
import { existsSync } from 'node:fs';
import {
  loadEndpointConfigs,
  finalizeEndpoints,
} from '../lib/backfill-embedding-v2/endpoints';
import { installBackfillSignalHandlers } from '../lib/backfill-embedding-v2/shutdown';
import { createLeaseReleaseStopController } from '../lib/backfill-embedding-v2/stop-controller';
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
import { formatFatalErrorForLog, safeErrorMessage } from '../lib/backfill-embedding-v2/secrets';
import { primaryPreflightPassed } from '../lib/backfill-embedding-v2/preflight-exit';
import { createCachedTier0Probe } from '../lib/backfill-embedding-v2/tier0-probe';

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

    const modelTag = endpoint.modelTag;

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

  const endpointInputs = loadEndpointConfigs(argv, { providerCli: cli.provider });
  const endpoints = finalizeEndpoints(endpointInputs);
  const secrets = endpointSecrets(endpoints);
  const log = (line: string) => console.log(line);

  const scheduleWindows = loadScheduleWindows(cli);
  const supabase = createBackfillSupabase(supabaseUrl, serviceKey);
  const tier0Probe = createCachedTier0Probe(supabase, { log, secrets });

  const healthByName = new Map<string, EndpointHealth>();
  for (const ep of endpoints) {
    healthByName.set(ep.name, new EndpointHealth());
  }

  for (const ep of endpoints) {
    const ok = await runPreflightForEndpoint(ep, embedQueryUrl, log);
    const health = healthByName.get(ep.name)!;
    if (ok) {
      health.markPreflightPassed();
    }
  }

  if (cli.preflightOnly) {
    process.exit(primaryPreflightPassed(endpoints, healthByName) ? 0 : 1);
  }

  const activeEndpoints = endpoints.filter((ep) => healthByName.get(ep.name)?.preflightOk);
  if (activeEndpoints.length === 0) {
    throw new Error('Ingen endepunkter bestod preflight');
  }

  const boundedRun = cli.maxBatches !== null;
  const shared = new SharedDbPressure();
  const workerIds: string[] = [];

  const stopController = createLeaseReleaseStopController(async () => {
    for (const id of workerIds) {
      await releaseWorkerClaims(supabase, id);
    }
  });

  installBackfillSignalHandlers(stopController.requestStop);

  await shared.refresh(supabase, { tier0Probe });

  const coordinator = (async () => {
    while (!stopController.isStopping()) {
      if (cli.stopFile && existsSync(cli.stopFile)) {
        log('[backfill-v2] stop-file funnet — avslutter.');
        await stopController.requestStop();
        break;
      }
      await shared.refresh(supabase, boundedRun ? {} : { tier0Probe });
      if (shared.isPaused()) {
        log('[backfill-v2] delt DB-pause (WAL/slot) — alle workers venter');
      }
      if (!boundedRun) {
        for (const ep of activeEndpoints) {
          const health = healthByName.get(ep.name)!;
          if (health.needsPreflight) {
            const ok = await runPreflightForEndpoint(ep, embedQueryUrl, log);
            if (ok) health.markPreflightPassed();
          }
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
        maxBatches: cli.maxBatches,
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
        probeBeforeBatch: cli.probeBeforeBatch,
        secrets,
        sleep,
        log,
      },
      () =>
        stopController.isStopping() ||
        Boolean(cli.stopFile && existsSync(cli.stopFile)),
    );
  });

  await Promise.all(workers);
  if (boundedRun) {
    log(
      `[backfill-v2] fullførte batch-grense${cli.maxBatches === 1 ? '' : ` (${cli.maxBatches} batches per worker)`} — avslutter.`,
    );
    await stopController.requestStop();
  }
  await coordinator;
}

main().catch((err) => {
  console.error(formatFatalErrorForLog(err));
  process.exit(1);
});
