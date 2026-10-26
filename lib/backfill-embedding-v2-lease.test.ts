import assert from 'node:assert/strict';
import {
  compareClaimSortKeys,
  sortClaimCandidates,
  type ClaimSortKey,
} from './backfill-embedding-v2/claim-order';
import { installBackfillSignalHandlers, releaseAllWorkerClaims } from './backfill-embedding-v2/shutdown';
import type { BackfillSupabase } from './backfill-embedding-v2/supabase-client';

type LeasedChunk = {
  id: string;
  worker?: string;
  claimedAtMs: number;
};

class LeaseMockDb {
  chunks: LeasedChunk[] = [];
  leaseSeconds = 300;

  claim(worker: string, limit: number, nowMs: number): string[] {
    const picked: string[] = [];
    for (const c of this.chunks) {
      const expired =
        c.worker !== undefined &&
        nowMs - c.claimedAtMs > this.leaseSeconds * 1000;
      if (c.worker && !expired) continue;
      c.worker = worker;
      c.claimedAtMs = nowMs;
      picked.push(c.id);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  release(worker: string): number {
    let n = 0;
    for (const c of this.chunks) {
      if (c.worker === worker) {
        c.worker = undefined;
        n += 1;
      }
    }
    return n;
  }
}

async function main(): Promise<void> {
  const keys: ClaimSortKey[] = [
    {
      lane: 'background',
      issueTier: 3,
      documentKind: 'referat',
      issueId: '200100',
      chunkIndex: 0,
      chunkId: 'c-low',
    },
    {
      lane: 'background',
      issueTier: 1,
      documentKind: 'innstilling',
      issueId: '200200',
      chunkIndex: 0,
      chunkId: 'c-hot',
    },
    {
      lane: 'background',
      issueTier: 2,
      documentKind: 'hoveddokument',
      issueId: '200150',
      chunkIndex: 1,
      chunkId: 'c-mid',
    },
  ];
  const sorted = sortClaimCandidates(keys);
  assert.equal(sorted[0].issueTier, 1);
  assert.equal(sorted[1].issueTier, 2);
  assert.equal(sorted[2].issueTier, 3);
  assert.ok(compareClaimSortKeys(sorted[0], sorted[2]) < 0);

  const db = new LeaseMockDb();
  db.chunks = [{ id: 'a', claimedAtMs: 0 }, { id: 'b', claimedAtMs: 0 }];
  const t0 = 1_000_000;
  assert.deepEqual(db.claim('w1', 2, t0), ['a', 'b']);
  assert.deepEqual(db.claim('w2', 2, t0 + 1000), []);
  const expiredAt = t0 + db.leaseSeconds * 1000 + 1;
  assert.deepEqual(db.claim('w2', 2, expiredAt), ['a', 'b']);
  assert.equal(db.release('w2'), 2);

  let released = 0;
  const supabase = {
    rpc: async (name: string) => {
      if (name === 'n8n_release_embedding_v2_claims') {
        released += 1;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  } as BackfillSupabase;

  await releaseAllWorkerClaims(supabase, ['a@host', 'b@host']);
  assert.equal(released, 2);

  let stopCalls = 0;
  const onStop = async () => {
    stopCalls += 1;
    await releaseAllWorkerClaims(supabase, ['sig@host']);
  };
  const sigtermBefore = process.listenerCount('SIGTERM');
  installBackfillSignalHandlers(onStop);
  assert.equal(process.listenerCount('SIGTERM'), sigtermBefore + 1);
  await onStop();
  assert.equal(stopCalls, 1);
  assert.equal(released, 3);

  console.log('backfill-embedding-v2-lease.test.ts: ok');
}

void main();
