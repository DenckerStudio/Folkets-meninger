import assert from 'node:assert/strict';
import { EndpointHealth } from './backfill-embedding-v2/endpoint-health';
import { finalizeEndpoints } from './backfill-embedding-v2/endpoints';
import { primaryPreflightPassed } from './backfill-embedding-v2/preflight-exit';
import {
  formatFatalErrorForLog,
  redactSensitiveLogText,
} from './backfill-embedding-v2/secrets';
import { SharedDbPressure } from './backfill-embedding-v2/shared-pressure';
import { buildWorkerId, runEndpointWorkerLoop } from './backfill-embedding-v2/worker';
import type { BackfillSupabase } from './backfill-embedding-v2/supabase-client';

function primaryEndpoints() {
  return finalizeEndpoints([
    { name: 'server', provider: 'lmstudio', url: 'https://srv/v1', primary: true },
    {
      name: 'pc',
      provider: 'lmstudio',
      url: 'https://pc/v1',
      primary: false,
      lanes: ['background'],
    },
  ]);
}

async function main(): Promise<void> {
  const raw =
    'fetch failed https://user:supersecret@embed.local/v1 Authorization: Bearer tok_abc api_key=deadbeef';
  const redacted = redactSensitiveLogText(raw, ['supersecret', 'deadbeef']);
  assert.ok(!redacted.includes('supersecret'));
  assert.ok(!redacted.includes('deadbeef'));
  assert.ok(!redacted.includes('tok_abc'));
  assert.ok(!redacted.includes('user:supersecret'));

  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret';
  const fatal = formatFatalErrorForLog(
    new Error(`PostgREST ${process.env.SUPABASE_SERVICE_ROLE_KEY}`),
  );
  assert.ok(!fatal.includes(process.env.SUPABASE_SERVICE_ROLE_KEY!));
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const endpoints = primaryEndpoints();
  const health = new Map<string, EndpointHealth>();
  for (const ep of endpoints) {
    health.set(ep.name, new EndpointHealth());
  }
  health.get('pc')!.markPreflightPassed();
  assert.equal(primaryPreflightPassed(endpoints, health), false);
  health.get('server')!.markPreflightPassed();
  assert.equal(primaryPreflightPassed(endpoints, health), true);

  const claimed: { worker?: string }[] = [{ worker: undefined }];
  let releaseCalls = 0;
  let claimCalls = 0;
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'n8n_claim_chunks_missing_v2') {
        claimCalls += 1;
        if (claimCalls > 1) {
          return { data: [], error: null };
        }
        claimed[0].worker = String(args.p_worker);
        return {
          data: [
            {
              id: 'c1',
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
        claimed[0].worker = undefined;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as unknown as BackfillSupabase;

  const shared = new SharedDbPressure();
  const endpointHealth = new EndpointHealth();
  endpointHealth.markPreflightPassed();
  let loops = 0;
  const workerId = buildWorkerId('server');
  assert.match(workerId, /^server@/);
  assert.ok(workerId.includes(String(process.pid)));

  await runEndpointWorkerLoop(
    {
      supabase,
      endpoint: endpoints[0],
      workerId,
      leaseSeconds: 300,
      dryRun: true,
      shared,
      health: endpointHealth,
      scheduleWindows: [],
      scheduleTimeZone: 'Europe/Oslo',
      maxBatchesPerMin: 60,
      fullMaxBatchesPerMin: 60,
      fastLaneMinBatchesPerMin: 1,
      busyLatencyMs: 1500,
      busyPauseFlag: false,
      allowGpu: false,
      probeBeforeBatch: false,
      secrets: [],
      sleep: async () => {},
      log: () => {},
    },
    () => {
      loops += 1;
      return loops > 2;
    },
  );

  assert.equal(releaseCalls, 1);
  assert.equal(claimed[0].worker, undefined);

  process.env.EMBED_BACKFILL_WORKER_ID = 'custom-worker';
  assert.equal(buildWorkerId('server'), 'server@custom-worker');
  delete process.env.EMBED_BACKFILL_WORKER_ID;

  console.log('backfill-embedding-v2-safety.test.ts: ok');
}

void main();
