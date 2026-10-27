import assert from 'node:assert/strict';
import {
  getSakTreatmentLabel,
  resolveSakListStatus,
  resolveSakStatusFromSources,
} from './sak-status';

// Stortinget status codes: 1 = ferdigbehandlet (closed), 2/3 = under behandling (pending).
assert.equal(resolveSakListStatus({ ferdigbehandlet: true, numericStatus: 1 }), 'closed');
assert.equal(resolveSakListStatus({ ferdigbehandlet: true, numericStatus: 3 }), 'closed');
assert.equal(resolveSakListStatus({ ferdigbehandlet: false, numericStatus: 1 }), 'pending');
assert.equal(resolveSakListStatus({ ferdigbehandlet: false, numericStatus: 2 }), 'pending');
assert.equal(resolveSakListStatus({ numericStatus: 1 }), 'closed');
assert.equal(resolveSakListStatus({ numericStatus: 2 }), 'pending');
assert.equal(resolveSakListStatus({ numericStatus: 3 }), 'pending');
assert.equal(resolveSakListStatus({ cachedStatus: 'closed' }), 'closed');
assert.equal(resolveSakListStatus({ cachedStatus: 'pending' }), 'pending');
// Fresh list export wins over a stale cached DB string (sak 200461-style: list status=2).
assert.equal(resolveSakListStatus({ cachedStatus: 'closed', numericStatus: 2 }), 'pending');
assert.equal(resolveSakListStatus({ cachedStatus: 'closed', numericStatus: 1 }), 'closed');
// Unknown data defaults to "Under behandling" rather than wrongly claiming "Ferdigbehandlet".
assert.equal(resolveSakListStatus({}), 'pending');
assert.equal(getSakTreatmentLabel('closed'), 'Ferdigbehandlet');
assert.equal(getSakTreatmentLabel('pending'), 'Under behandling');

// detail_json.ferdigbehandlet is trusted over the numeric status.
assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'closed',
    detailJson: { ferdigbehandlet: false, status: 1 },
  }),
  'pending',
);
assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'pending',
    numericStatus: 1,
    detailJson: { ferdigbehandlet: true, status: 1 },
  }),
  'closed',
);
assert.equal(
  resolveSakStatusFromSources({
    cachedStatus: 'pending',
    numericStatus: 2,
  }),
  'pending',
);

// Live list status=3 (under behandling) with detail ferdigbehandlet=false stays pending.
assert.equal(
  resolveSakStatusFromSources({
    ferdigbehandlet: false,
    detailJson: { ferdigbehandlet: false, status: 1 },
    cachedStatus: 'pending',
    numericStatus: 3,
  }),
  'pending',
);

// Stale DB column (false) must not override cached detail_json (true) — sak 200211.
assert.equal(
  resolveSakStatusFromSources({
    ferdigbehandlet: false,
    detailJson: { ferdigbehandlet: true, status: 1 },
    cachedStatus: 'closed',
    numericStatus: 1,
  }),
  'closed',
);

console.log('sak-status.test.ts: ok');
