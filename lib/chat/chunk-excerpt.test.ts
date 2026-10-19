import assert from 'node:assert/strict';
import {
  CHAT_EXCERPT_MAX_CHARS,
  CHAT_EXCERPT_TOTAL_BUDGET_CHARS,
  applyChunkExcerptsForChat,
  excerptChunkForQuery,
} from './chunk-excerpt';

const prefix = 'A'.repeat(2000);
const middle = ' økonomiske konsekvenser kroner ';
const suffix = 'B'.repeat(2000);
const long = `${prefix}${middle}${suffix}`;

const windowed = excerptChunkForQuery(long, 'økonomiske konsekvenser', 800);
assert.ok(windowed.includes('økonomiske konsekvenser'));
assert.ok(windowed.length <= 820);
assert.ok(!windowed.startsWith('AAAA'), 'should not head-truncate when query matches later');

const short = excerptChunkForQuery('Kort tekst.', 'foo', 100);
assert.equal(short, 'Kort tekst.');

const chunks = [
  { content: 'x'.repeat(5000), rank: 10, chunkIndex: 0 },
  { content: 'y'.repeat(5000), rank: 5, chunkIndex: 1 },
  { content: 'z'.repeat(5000), rank: 1, chunkIndex: 2 },
];

const fitted = applyChunkExcerptsForChat(chunks, 'query', {
  maxPerExcerpt: 1000,
  totalBudget: 1000,
});
assert.equal(fitted.length, 1);
assert.ok(fitted[0].content.length <= 1000);
assert.equal(fitted[0].rank, 10);

const fittedPair = applyChunkExcerptsForChat(chunks, 'query', {
  maxPerExcerpt: 600,
  totalBudget: 1100,
});
assert.equal(fittedPair.length, 2);
assert.ok(fittedPair[0].content.length + fittedPair[1].content.length <= 1100);

assert.equal(CHAT_EXCERPT_MAX_CHARS, 4800);
assert.equal(CHAT_EXCERPT_TOTAL_BUDGET_CHARS, 16_000);

// mergeChunks order: semantic (0–1) before lexical (10+). Budget must not re-sort by rank.
const semanticFirst = [
  { content: `SEMANTIC_TARGET ${'a'.repeat(1800)}`, rank: 0.91, chunkIndex: 0 },
  { content: `lexical_noise ${'b'.repeat(1800)}`, rank: 55, chunkIndex: 1 },
  { content: `lexical_noise2 ${'c'.repeat(1800)}`, rank: 54, chunkIndex: 2 },
];
const semanticBudgeted = applyChunkExcerptsForChat(semanticFirst, 'SEMANTIC_TARGET', {
  maxPerExcerpt: 1900,
  totalBudget: 1850,
});
assert.equal(semanticBudgeted.length, 1, 'tight budget keeps only first (semantic) chunk in merge order');
assert.equal(semanticBudgeted[0].rank, 0.91);
assert.ok(semanticBudgeted[0].content.includes('SEMANTIC_TARGET'));

const wronglySorted = [...semanticFirst].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
const wouldDropSemantic = applyChunkExcerptsForChat(wronglySorted, 'SEMANTIC_TARGET', {
  maxPerExcerpt: 1900,
  totalBudget: 1850,
});
assert.notEqual(
  wouldDropSemantic[0]?.rank,
  0.91,
  're-sorting by rank would prefer lexical and drop BYOK semantic hits',
);

console.log('chat/chunk-excerpt.test.ts: ok');
