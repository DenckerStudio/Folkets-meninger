import assert from 'node:assert/strict';
import {
  adminLoadErrorJson,
  adminLoadErrorMessage,
  postgrestErrorCode,
} from '@/lib/admin/postgrest-error';

assert.equal(postgrestErrorCode({ code: '25006', message: 'read-only' }), '25006');
assert.equal(postgrestErrorCode(new Error('x')), null);

const payload = adminLoadErrorJson('Kunne ikke hente køstatus', {
  code: '25006',
  message: 'cannot execute INSERT in a read-only transaction',
});
assert.equal(payload.errorCode, '25006');
assert.match(payload.error, /Kunne ikke hente køstatus/);
assert.match(payload.error, /25006/);

const noCode = adminLoadErrorJson('Kunne ikke hente køstatus', new Error('nettverk'));
assert.equal(noCode.error, 'Kunne ikke hente køstatus');
assert.equal(noCode.errorCode, undefined);
assert.doesNotMatch(noCode.error, /ukjent/);

assert.equal(
  adminLoadErrorMessage('Feil', { code: 'PGRST202', message: 'not found' }),
  'Feil (kode PGRST202)',
);
assert.equal(adminLoadErrorMessage('Feil', new Error('x')), 'Feil');

console.log('admin/postgrest-error.test.ts: ok');
