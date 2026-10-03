import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatDeepLinkQuery,
  resolveChatGate,
  shouldOpenChatFromSearchParams,
} from '@/lib/chat/overlay';

test('resolveChatGate prefers login, then Stemme+, then BYOK', () => {
  assert.equal(
    resolveChatGate({ authenticated: false, hasStemmePlus: false, hasByok: false }),
    'login',
  );
  assert.equal(
    resolveChatGate({ authenticated: true, hasStemmePlus: false, hasByok: true }),
    'free',
  );
  assert.equal(
    resolveChatGate({ authenticated: true, hasStemmePlus: true, hasByok: false }),
    'no-key',
  );
  assert.equal(
    resolveChatGate({ authenticated: true, hasStemmePlus: true, hasByok: true }),
    'ready',
  );
});

test('chat query opens the overlay for 1 or open', () => {
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('chat=1')), true);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('chat=open')), true);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('sak=1')), false);
});

test('chatDeepLinkQuery keeps optional sak', () => {
  assert.equal(chatDeepLinkQuery(), 'chat=1');
  assert.equal(chatDeepLinkQuery(' 104 '), 'chat=1&sak=104');
});
