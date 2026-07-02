import assert from 'node:assert/strict';
import {
  getSakTreatmentLabel,
  inferFerdigbehandletFromListSak,
  resolveSakListStatus,
  resolveSakStatusFromSources,
  resolveSakTreatmentStatus,
} from './sak-status';

assert.equal(resolveSakListStatus({ ferdigbehandlet: true, numericStatus: 1 }), 'closed');
assert.equal(resolveSakListStatus({ ferdigbehandlet: false, numericStatus: 2 }), 'closed');
assert.equal(resolveSakListStatus({ ferdigbehandlet: false, numericStatus: 1 }), 'pending');
assert.equal(resolveSakListStatus({ numericStatus: 1 }), 'pending');
assert.equal(resolveSakListStatus({ numericStatus: 2 }), 'closed');
assert.equal(resolveSakListStatus({ cachedStatus: 'closed', numericStatus: 1 }), 'closed');
assert.equal(inferFerdigbehandletFromListSak({ innstilling_id: 1, innstilling_kode: 1 }), true);
assert.equal(resolveSakTreatmentStatus({ numericStatus: 2 }), 'closed');
assert.equal(getSakTreatmentLabel('closed'), 'Ferdigbehandlet');
assert.equal(getSakTreatmentLabel('pending'), 'Under behandling');

assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'closed',
    listInnstilling: { innstilling_id: 1, innstilling_kode: 1 },
    detailJson: { ferdigbehandlet: false, status: 1 },
  }),
  'pending',
);
assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'pending',
    numericStatus: 1,
    listInnstilling: { innstilling_id: 1, innstilling_kode: 1 },
    detailJson: { ferdigbehandlet: true, status: 1 },
  }),
  'closed',
);
assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'pending',
    listInnstilling: { innstilling_id: 1, innstilling_kode: 1 },
    numericStatus: 1,
  }),
  'closed',
);

console.log('sak-status.test.ts: ok');
