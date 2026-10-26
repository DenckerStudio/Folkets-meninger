import assert from 'node:assert/strict';
import { formatFatalErrorForLog, safeErrorMessage } from './secrets';

const postgrestClaimError = {
  message: 'canceling statement due to statement timeout',
  code: '57014',
  details: null,
  hint: null,
};

assert.equal(
  safeErrorMessage(postgrestClaimError),
  'canceling statement due to statement timeout code=57014',
);
assert.ok(!safeErrorMessage(postgrestClaimError).includes('[object Object]'));

assert.equal(safeErrorMessage(new Error('nettverksfeil')), 'nettverksfeil');
assert.equal(safeErrorMessage('direkte streng'), 'direkte streng');

const secret = 'sk-live-embedding-backfill-secret-value';
const withSecret = {
  message: `RPC feilet med nøkkel ${secret}`,
  code: 'PGRST301',
};
const redacted = safeErrorMessage(withSecret, [secret]);
assert.ok(!redacted.includes(secret));
assert.match(redacted, /sk\*\*\*ue/);
assert.match(redacted, /RPC feilet med nøkkel/);
assert.match(redacted, /code=PGRST301/);

process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
const fatal = formatFatalErrorForLog(withSecret);
assert.ok(!fatal.includes(secret));
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('lib/backfill-embedding-v2/secrets.test.ts: ok');
