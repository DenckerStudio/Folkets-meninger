import assert from 'node:assert/strict';
import {
  isShortExactPlaceToken,
  parseParliamentaryRefs,
  looksLikeHearingId,
} from './parliamentary-ref';

assert.deepEqual(parseParliamentaryRefs('103102'), [
  { kind: 'issue_id', needle: '103102', issueId: '103102' },
]);
assert.ok(looksLikeHearingId('10005964'));
assert.equal(parseParliamentaryRefs('Prop. 133 L')[0]?.needle, 'Prop. 133 L');
assert.equal(parseParliamentaryRefs('Innst. 37 L')[0]?.needle, 'Innst. 37 L');
assert.match(parseParliamentaryRefs('Dokument 8:1 S')[0]?.needle ?? '', /Dokument 8:1/);
assert.ok(isShortExactPlaceToken('Ås'));
assert.ok(!isShortExactPlaceToken('abc'));

console.log('parliamentary-ref.test.ts: ok');
