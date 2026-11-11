import assert from 'node:assert/strict';
import { parseBackfillArgv, resolveMaxBatches } from './backfill-embedding-v2/parse-args';
import { EndpointHealth } from './backfill-embedding-v2/endpoint-health';
import { finalizeEndpoints } from './backfill-embedding-v2/endpoints';
import { buildWorkerId, runEndpointWorkerLoop } from './backfill-embedding-v2/worker';
import { SharedDbPressure } from './backfill-embedding-v2/shared-pressure';
import type { BackfillSupabase } from './backfill-embedding-v2/supabase-client';

function endpoint() {
  return finalizeEndpoints([
    {
      name: 'server',
      provider: 'ollama',
      url: 'http://ollama-host.example.invalid:11435',
      primary: true,
    },
  ])[0];
}

function mockSupabase(claimLimit: number) {
  let claimCalls = 0;
  let releaseCalls = 0;
  const supabase = {
    rpc: async (name: string) => {
      if (name === 'n8n_claim_chunks_missing_v2') {
        claimCalls += 1;
        if (claimCalls > claimLimit) {
          return {
            data: [],
            error: null,
          };
        }
        return {
          data: [
            {
              id: `chunk-${claimCalls}`,
              content: 'tekst',
              chunk_index: 0,
              issue_id: '200329',
            },
          ],
          error: null,
        };
      }
      if (name === 'n8n_release_embedding_v2_claims') {
        releaseCalls += 1;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as BackfillSupabase;
  return { supabase, metrics: () => ({ claimCalls, releaseCalls }) };
}

async function runWorker(maxBatches: number | null, dryRun: boolean): Promise<number> {
  const { supabase, metrics } = mockSupabase(10);
  const shared = new SharedDbPressure();
  shared.tier0Pending = false;
  const health = new EndpointHealth();
  health.markPreflightPassed();
  let loops = 0;
  await runEndpointWorkerLoop(
    {
      supabase,
      endpoint: endpoint(),
      workerId: buildWorkerId('server'),
      leaseSeconds: 300,
      dryRun,
      maxBatches,
      shared,
      health,
      scheduleWindows: [],
      scheduleTimeZone: 'Europe/Oslo',
      maxBatchesPerMin: 60,
      fullMaxBatchesPerMin: 60,
      fastLaneMinBatchesPerMin: 1,
      busyLatencyMs: 1500,
      busyPauseFlag: false,
      probeBeforeBatch: false,
      secrets: [],
      sleep: async () => {},
      log: () => {},
      embedHttpTimeoutMs: 60_000,
    },
    () => {
      loops += 1;
      return loops > 500;
    },
  );
  return metrics().claimCalls;
}

async function main(): Promise<void> {
  assert.equal(resolveMaxBatches(['--dry-run'], true), 1);
  assert.equal(resolveMaxBatches(['--max-batches', '3'], false), 3);
  assert.equal(resolveMaxBatches([], false), null);

  assert.throws(() => resolveMaxBatches(['--max-batches', '0'], false));
  assert.throws(() => resolveMaxBatches(['--max-batches', '2.5'], false));

  const dryCli = parseBackfillArgv(['--dry-run']);
  assert.equal(dryCli.maxBatches, 1);
  const cappedCli = parseBackfillArgv(['--max-batches', '3']);
  assert.equal(cappedCli.maxBatches, 3);
  assert.equal(cappedCli.dryRun, false);

  const dryClaims = await runWorker(1, true);
  assert.equal(dryClaims, 1);

  const threeClaims = await runWorker(3, true);
  assert.equal(threeClaims, 3);

  console.log('backfill-embedding-v2-max-batches.test.ts: ok');
}

void main();
