import assert from 'node:assert/strict';
import { fitSnapshotToMaxBytes, SNAPSHOT_MAX_BYTES, snapshotByteLength } from '@/lib/content-feedback/snapshot';

const huge = 'å'.repeat(20_000);
const oversized = {
  title: 'Kort',
  narrative: huge,
  issue_id: '12345',
};

const fitted = fitSnapshotToMaxBytes(oversized);
assert.ok(snapshotByteLength(fitted) <= SNAPSHOT_MAX_BYTES);
assert.equal(fitted.truncated, true);
assert.ok(typeof fitted.narrative === 'string');
assert.ok((fitted.narrative as string).length < huge.length);

const small = fitSnapshotToMaxBytes({ title: 'Hei', issue_id: '1' });
assert.ok(small.truncated !== true);
assert.ok(snapshotByteLength(small) <= SNAPSHOT_MAX_BYTES);

const minimal = fitSnapshotToMaxBytes({ narrative: huge, title: 'T', issue_id: '99' }, 20);
assert.ok(snapshotByteLength(minimal) <= SNAPSHOT_MAX_BYTES);
assert.equal(minimal.truncated, true);

console.log('content-feedback/snapshot.test.ts: ok');
