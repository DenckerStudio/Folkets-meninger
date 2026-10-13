import assert from 'node:assert/strict';
import {
  CHAT_ERROR_DEFAULT,
  CHAT_ERROR_NETWORK,
  CHAT_ERROR_RATE_LIMIT,
  chatErrorMessage,
} from './errors';

assert.equal(chatErrorMessage(undefined), CHAT_ERROR_DEFAULT);
assert.equal(chatErrorMessage(''), CHAT_ERROR_DEFAULT);
assert.equal(chatErrorMessage(new Error('An error occurred.')), CHAT_ERROR_DEFAULT);
assert.equal(chatErrorMessage(new Error('Rate limit exceeded')), CHAT_ERROR_RATE_LIMIT);
assert.equal(chatErrorMessage('Too many requests'), CHAT_ERROR_RATE_LIMIT);
assert.equal(chatErrorMessage(new TypeError('Failed to fetch')), CHAT_ERROR_NETWORK);
assert.match(chatErrorMessage(new Error('Unauthorized')), /Nøkkelen/);
assert.match(chatErrorMessage(new Error('Something odd happened')), /Noe gikk galt/);

console.log('chat/errors.test.ts: ok');
