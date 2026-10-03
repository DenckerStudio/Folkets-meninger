import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatLoginNextPath,
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

test('buildChatLoginNextPath keeps chat reopen + optional sak', () => {
  assert.equal(
    buildChatLoginNextPath('/dashboard/utforsk', null),
    '/dashboard/utforsk?chat=1',
  );
  assert.equal(
    buildChatLoginNextPath('/dashboard/utforsk', '200417'),
    '/dashboard/utforsk?chat=1&sak=200417',
  );
  assert.equal(
    buildChatLoginNextPath('/dashboard/sak/200417', '200417'),
    '/dashboard/sak/200417?chat=1&sak=200417',
  );
  // Strip accidental query on pathname input
  assert.equal(
    buildChatLoginNextPath('/dashboard/utforsk?foo=1', '104'),
    '/dashboard/utforsk?chat=1&sak=104',
  );
});
