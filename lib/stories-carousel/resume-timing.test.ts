import assert from 'node:assert/strict';
import { computeResume } from '@/lib/stories-carousel/resume-timing';

const duration = 4000;
const now = 1_000_000;

{
  const { startTimeMs, remainingMs } = computeResume(0, duration, now);
  assert.equal(startTimeMs, now);
  assert.equal(remainingMs, duration);
}

{
  const { startTimeMs, remainingMs } = computeResume(50, duration, now);
  assert.equal(startTimeMs, now - 2000);
  assert.equal(remainingMs, 2000);
}

{
  const { startTimeMs, remainingMs } = computeResume(25, duration, now);
  assert.equal(startTimeMs, now - 1000);
  assert.equal(remainingMs, 3000);
}

{
  const { remainingMs } = computeResume(100, duration, now);
  assert.equal(remainingMs, 0);
}

{
  const { startTimeMs, remainingMs } = computeResume(-10, duration, now);
  assert.equal(startTimeMs, now);
  assert.equal(remainingMs, duration);
}

{
  const { remainingMs } = computeResume(150, duration, now);
  assert.equal(remainingMs, 0);
}

console.log('lib/stories-carousel/resume-timing.test.ts ok');
