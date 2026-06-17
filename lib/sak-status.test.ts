import assert from 'node:assert/strict';
import { getSakTreatmentLabel, resolveSakTreatmentStatus } from './sak-status';

assert.equal(
  resolveSakTreatmentStatus({ ferdigbehandlet: true, numericStatus: 1 }),
  'closed',
);
assert.equal(
  resolveSakTreatmentStatus({ ferdigbehandlet: false, numericStatus: 2 }),
  'pending',
);
assert.equal(resolveSakTreatmentStatus({ numericStatus: 1 }), 'pending');
assert.equal(resolveSakTreatmentStatus({ numericStatus: 2 }), 'pending');
assert.equal(getSakTreatmentLabel('closed'), 'Ferdigbehandlet');
assert.equal(getSakTreatmentLabel('pending'), 'Under behandling');

console.log('sak-status.test.ts: ok');
