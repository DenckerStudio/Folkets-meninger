import assert from 'node:assert/strict';
import { resolveCurrentSaksgangStepIndex, resolveCurrentSaksgangStepName } from './saksgang-current-step';

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
  resolveCurrentSaksgangStepName(
    [
      { navn: 'A', events: [{ label: 'x', date: '1' }] },
      { navn: 'B', events: [] },
    ],
    false,
  ),
  'B',
);

console.log('saksgang-current-step.test.ts OK');