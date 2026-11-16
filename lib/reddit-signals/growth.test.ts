import assert from 'node:assert/strict';
import { computeGrowth24hEngagement } from '@/lib/reddit-signals/growth';

const now = Date.parse('2026-11-16T12:00:00.000Z');

const growth = computeGrowth24hEngagement(
  { score: 100, numComments: 40, numCrossposts: 2 },
  [
    {
      capturedAt: '2026-11-15T10:00:00.000Z',
      score: 60,
      numComments: 20,
      numCrossposts: 0,
    },
    {
      capturedAt: '2026-11-15T11:30:00.000Z',
      score: 70,
      numComments: 24,
      numCrossposts: 1,
    },
  ],
  now,
);

assert.equal(growth, 100 + 80 + 10 - (70 + 48 + 5));

assert.equal(
  computeGrowth24hEngagement(
    { score: 10, numComments: 2, numCrossposts: null },
    [{ capturedAt: '2026-11-16T11:00:00.000Z', score: 5, numComments: 1, numCrossposts: null }],
    now,
  ),
  null,
);

console.log('lib/reddit-signals/growth.test.ts: ok');