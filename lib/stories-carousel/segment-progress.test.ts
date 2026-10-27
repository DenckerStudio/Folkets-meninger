import assert from 'node:assert/strict';
import { segmentProgressPercent } from '@/lib/stories-carousel/segment-progress';

assert.equal(segmentProgressPercent(0, 1, 40, true), 100);
assert.equal(segmentProgressPercent(2, 1, 40, true), 0);

assert.equal(segmentProgressPercent(1, 1, 35, true), 35);
assert.equal(segmentProgressPercent(1, 1, 35, false), 100);

assert.equal(segmentProgressPercent(1, 1, 60, true), 60);

console.log('lib/stories-carousel/segment-progress.test.ts ok');
