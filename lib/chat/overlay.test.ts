import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChatLoginNextPath,
  canUseOverlayActions,
  chatDeepLinkQuery,
  chatLoginHref,
  issueIdFromPathname,
  resolveChatGate,
  shouldOpenChatFromSearchParams,
} from '@/lib/chat/overlay';
import { loginWithNext } from '@/lib/safe-redirect';
import { routes } from '@/lib/routes';

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

test('overlay actions require Stemme+ but not BYOK', () => {
  assert.equal(canUseOverlayActions('login'), false);
  assert.equal(canUseOverlayActions('free'), false);
  assert.equal(canUseOverlayActions('no-key'), true);
  assert.equal(canUseOverlayActions('ready'), true);
});

test('chat query opens the overlay for 1 or open', () => {
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('chat=1')), true);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('chat=open')), true);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('sak=1')), false);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('')), false);
  assert.equal(shouldOpenChatFromSearchParams(new URLSearchParams('chat=true')), false);
});

test('issueIdFromPathname reads /dashboard/sak/[id]', () => {
  assert.equal(issueIdFromPathname('/dashboard/sak/200365'), '200365');
  assert.equal(issueIdFromPathname('/dashboard/sak/200365?chat=1'), '200365');
  assert.equal(issueIdFromPathname('/dashboard/utforsk'), null);
  assert.equal(issueIdFromPathname('/dashboard/sak/200365/dokumenter'), null);
  assert.equal(issueIdFromPathname(null), null);
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

test('chatLoginHref uses loginWithNext and keeps overlay reopen', () => {
  assert.equal(
    chatLoginHref('/dashboard/utforsk', null),
    loginWithNext('/dashboard/utforsk?chat=1'),
  );
  assert.equal(
    chatLoginHref('/dashboard/utforsk', '200417'),
    loginWithNext('/dashboard/utforsk?chat=1&sak=200417'),
  );
  assert.equal(
    chatLoginHref('/dashboard/sak/200417', '200417'),
    loginWithNext('/dashboard/sak/200417?chat=1&sak=200417'),
  );
  assert.equal(chatLoginHref('https://evil.example', '200417'), loginWithNext(routes.utforsk));
  assert.equal(chatLoginHref('//evil.example', '200417'), loginWithNext(routes.utforsk));
  assert.equal(chatLoginHref(routes.login, '200417'), loginWithNext(routes.utforsk));
});
