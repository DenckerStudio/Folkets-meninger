import assert from 'node:assert/strict';
import { adminReelDraftUrl } from '@/lib/admin/research/labels';
import { adminVurderHref, parseVurderTab } from '@/lib/admin/vurder-tabs';

assert.equal(parseVurderTab(null), 'reels');
assert.equal(parseVurderTab(''), 'reels');
assert.equal(parseVurderTab('ukjent'), 'reels');
assert.equal(parseVurderTab('reels'), 'reels');
assert.equal(parseVurderTab('blogg'), 'blogg');
assert.equal(parseVurderTab('sammendrag'), 'sammendrag');

assert.equal(adminVurderHref('blogg'), '/dashboard/admin/vurder?fane=blogg');
assert.equal(
  adminVurderHref('reels', 'a b'),
  '/dashboard/admin/vurder?fane=reels&pollId=a+b',
);
assert.equal(adminReelDraftUrl('poll-1'), '/dashboard/admin/vurder?fane=reels&pollId=poll-1');

console.log('admin/vurder-tabs.test.ts: ok');
