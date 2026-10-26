import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
  compareClaimSortKeys,
  sortClaimCandidates,
  type ClaimSortKey,
} from './backfill-embedding-v2/claim-order';
import {
  createLeaseReleaseStopController,
} from './backfill-embedding-v2/stop-controller';
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  let releaseCalls = 0;
  const stopController = createLeaseReleaseStopController(async () => {
    releaseCalls += 1;
  });
  await stopController.requestStop();
  await stopController.requestStop();
  assert.equal(releaseCalls, 1);
  assert.equal(stopController.isStopping(), true);

  let stopCalls = 0;
  const onStop = async () => {
    stopCalls += 1;
    await sleep(30);
    await releaseAllWorkerClaims(supabase, ['sig@host']);
  };
  const originalExit = process.exit;
  let exitCount = 0;
  process.exit = ((code?: number) => {
    exitCount += 1;
    if (exitCount > 1) {
      throw new Error('exit called twice');
    }
    void code;
  }) as typeof process.exit;

  installBackfillSignalHandlers(onStop);
  process.emit('SIGTERM');
  process.emit('SIGTERM');
  await sleep(80);
  process.exit = originalExit;
  assert.equal(stopCalls, 1);
  assert.equal(released, 3);

  const secretStop = 'stop-fail-secret-key-xyz';
  let stopFailExit: number | null = null;
  const originalExit2 = process.exit;
  process.exit = ((code?: number) => {
    stopFailExit = code ?? 0;
  }) as typeof process.exit;
  installBackfillSignalHandlers(async () => {
    throw new Error(`Bearer ${secretStop}`);
  });
  process.emit('SIGTERM');
  await sleep(80);
  process.exit = originalExit2;
  assert.equal(stopFailExit, 1);

  const child = spawn(
    'npx',
    ['tsx', join(process.cwd(), 'lib/backfill-embedding-v2/signal-smoke-child.ts')],
    { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const stdout = await new Promise<string>((resolve, reject) => {
    let buf = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('signal-smoke-child timed out after 15s'));
    }, 15_000);
    child.stdout?.on('data', (chunk) => {
      buf += String(chunk);
    });
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`signal-smoke-child exit ${code}: ${buf}`));
        return;
      }
      resolve(buf);
    });
  });
  assert.match(stdout, /signal-smoke: ok/);

  console.log('backfill-embedding-v2-lease.test.ts: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
