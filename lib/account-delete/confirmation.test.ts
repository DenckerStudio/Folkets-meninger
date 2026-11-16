import assert from 'node:assert/strict';
import {
  accountDeleteConfirmationMatches,
  normalizeAccountDeleteConfirmation,
} from '@/lib/account-delete/confirmation';

assert.equal(normalizeAccountDeleteConfirmation('  slett  '), 'SLETT');
assert.equal(normalizeAccountDeleteConfirmation('Slett'), 'SLETT');
assert.equal(accountDeleteConfirmationMatches('slett'), true);
assert.equal(accountDeleteConfirmationMatches(' SLETT '), true);
assert.equal(accountDeleteConfirmationMatches('slettemeg'), false);

console.log('lib/account-delete/confirmation.test.ts: ok');