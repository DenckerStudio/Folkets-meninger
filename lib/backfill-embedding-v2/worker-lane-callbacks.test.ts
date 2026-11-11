import assert from 'node:assert/strict';
import { finalizeEndpoints } from './endpoints';
import { EndpointHealth } from './endpoint-health';
import { SharedDbPressure } from './shared-pressure';
import type { BackfillSupabase } from './supabase-client';
import { buildWorkerId, runEndpointWorkerLoop } from './worker';

const endpoint = finalizeEndpoints([
  {
    name: 'server',
    provider: 'ollama',
    url: 'http://ollama-host.example.invalid:11435',
    primary: true,
  },
])[0];

async function runOneFastLaneBatch(): Promise<{
  backgroundSaves: number;
  fastSaves: number;
  progressTouches: number;
}> {
  let backgroundSaves = 0;
  let fastSaves = 0;
  let progressTouches = 0;
  let claimCalls = 0;

  const supabase = {
    rpc: async (name: string, args?: { p_lane?: string }) => {
      if (name === 'n8n_claim_chunks_missing_v2') {
        claimCalls += 1;
        const lane = args?.p_lane ?? 'background';
        if (claimCalls > 2) {
          return { data: [], error: null };
        }
        return {
          data: [
            {
              id: `chunk-${lane}-${claimCalls}`,
              content: 'tekst',
              chunk_index: 0,
              issue_id: lane === 'fast' ? 't0-1' : 'bg-1',
            },
          ],
          error: null,
        };
      }
      if (name === 'save_embeddings_v2') {
        return { data: { saved: 1, skipped: 0 }, error: null };
      }
      if (name === 'n8n_release_embedding_v2_claims') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as BackfillSupabase;

  const shared = new SharedDbPressure();
  shared.tier0Pending = true;
  const health = new EndpointHealth();
  health.markPreflightPassed();

  let loops = 0;
  await runEndpointWorkerLoop(
    {
      supabase,
      endpoint,
      workerId: buildWorkerId('server'),
      leaseSeconds: 300,
      dryRun: false,
      maxBatches: 1,
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
      onProgress: () => {
        progressTouches += 1;
      },
      onBackgroundBatchSaved: () => {
        backgroundSaves += 1;
      },
      onFastLaneBatchSaved: () => {
        fastSaves += 1;
      },
    },
    () => {
      loops += 1;
      return loops > 200;
    },
  );

  return { backgroundSaves, fastSaves, progressTouches };
}

async function main(): Promise<void> {
  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({ embeddings: [Array.from({ length: 1024 }, (_, i) => i / 1024)] }),
      { status: 200 },
    );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    const { backgroundSaves, fastSaves, progressTouches } = await runOneFastLaneBatch();
    assert.equal(fastSaves, 1);
    assert.equal(backgroundSaves, 0);
    assert.equal(progressTouches, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('lib/backfill-embedding-v2/worker-lane-callbacks.test.ts: ok');
}

void main();
