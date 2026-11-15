import assert from 'node:assert/strict';
import {
  parseValgomatApiResponse,
  VALGOMAT_CONSENT_ERROR_CODE,
} from '@/lib/valgomat/api-client';

assert.equal(
  parseValgomatApiResponse(403, {
    error: 'Du må gi samtykke',
    code: VALGOMAT_CONSENT_ERROR_CODE,
    purpose: 'political_profiling',
  }).kind,
  'consent_required',
);

assert.equal(
  parseValgomatApiResponse(500, { error: 'Feil' }).kind,
  'error',
);

assert.equal(
  parseValgomatApiResponse(200, {
    hjertesaker: [],
    partisamsvar: [],
    stance_count: 0,
    party_alignment_available: true,
    comparable_issue_count: 0,
  }).kind,
  'success',
);

console.log('valgomat api-client tests passed');