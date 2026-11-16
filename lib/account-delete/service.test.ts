import assert from 'node:assert/strict';
import { isSameOriginPost } from '@/lib/api/same-origin-post';
import { accountDeleteConfirmationMatches } from '@/lib/account-delete/confirmation';
import {
  ACCOUNT_DELETED_QUERY_PARAM,
  ACCOUNT_DELETE_CONFIRMATION_TOKEN,
  SELF_DELETE_MISSING_MIGRATION_MESSAGE,
  SELF_DELETE_RPC_FAILED_MESSAGE,
  SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE,
} from '@/lib/account-delete/constants';

assert.equal(ACCOUNT_DELETE_CONFIRMATION_TOKEN, 'SLETT');
assert.match(SELF_DELETE_STEMME_PLUS_BLOCK_MESSAGE, /Stemme\+/);
assert.equal(ACCOUNT_DELETED_QUERY_PARAM, 'konto-slettet');
assert.match(SELF_DELETE_MISSING_MIGRATION_MESSAGE, /innspill/i);
assert.match(SELF_DELETE_RPC_FAILED_MESSAGE, /innspill/i);
assert.equal(accountDeleteConfirmationMatches('slett'), true);

assert.equal(
  isSameOriginPost(
    new Request('http://localhost/api/user/delete-account', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    }),
  ),
  true,
);

console.log('lib/account-delete/service.test.ts: ok');