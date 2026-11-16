import assert from 'node:assert/strict';
import { resolveCurrentSaksgangStepIndex } from '@/components/sak/saksgang-timeline';

assert.equal(
  resolveCurrentSaksgangStepIndex(
    [
      { navn: 'A', events: [{ label: 'x', date: '1' }] },
      { navn: 'B', events: [] },
    ],
    false,
  ),
  1,
);

assert.equal(
  resolveCurrentSaksgangStepIndex(
    [
      { navn: 'A', events: [{ label: 'x', date: '1' }] },
      { navn: 'B', events: [{ label: 'y', date: '2' }] },
    ],
    true,
  ),
  1,
);

console.log('saksgang-timeline.test.ts OK');