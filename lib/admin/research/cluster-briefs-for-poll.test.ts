import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchResearchClusterBriefsForPoll } from '@/lib/admin/research/cluster-briefs-for-poll';
import {
  expireStaleResearchBriefsThrottled,
  resetResearchBriefExpireThrottleForTests,
  RESEARCH_BRIEF_EXPIRE_THROTTLE_MS,
} from '@/lib/admin/research/expire-stale-throttled';

async function run(): Promise<void> {
  const briefsRoute = readFileSync(
    join(
      process.cwd(),
      'app/api/admin/research/clusters/[clusterId]/briefs/route.ts',
    ),
    'utf-8',
  );
  assert.match(briefsRoute, /fetchResearchClusterBriefsForPoll/);

  let expireCalls = 0;
  const briefs = {
    deepen: {
      kind: 'deepen' as const,
      status: 'failed' as const,
      output_ref: null,
      request_id: 'req-1',
      created_at: '2026-11-02T10:00:00.000Z',
      updated_at: '2026-11-02T10:30:00.000Z',
    },
  };

  const loaded = await fetchResearchClusterBriefsForPoll('cluster-a', {
    expireStale: async () => {
      expireCalls += 1;
      throw new Error('rpc unavailable');
    },
    loadBriefs: async () => briefs,
  });

  assert.equal(expireCalls, 1);
  assert.deepEqual(loaded, briefs);

  resetResearchBriefExpireThrottleForTests();
  let throttledCalls = 0;
  await expireStaleResearchBriefsThrottled({
    nowMs: 1_000_000,
    expire: async () => {
      throttledCalls += 1;
    },
  });
  await expireStaleResearchBriefsThrottled({
    nowMs: 1_000_000 + RESEARCH_BRIEF_EXPIRE_THROTTLE_MS - 1,
    expire: async () => {
      throttledCalls += 1;
    },
  });
  assert.equal(throttledCalls, 1);

  await expireStaleResearchBriefsThrottled({
    nowMs: 1_000_000 + RESEARCH_BRIEF_EXPIRE_THROTTLE_MS,
    expire: async () => {
      throttledCalls += 1;
    },
  });
  assert.equal(throttledCalls, 2);
}

run()
  .then(() => {
    console.log('cluster-briefs-for-poll.test.ts: ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
