import assert from 'node:assert/strict';
import {
  finalizeBlogDraftBodyWithSources,
  remapBlogBodyCitations,
} from '@/lib/blog/blog-citations';
import type { BlogPostSourcePublic } from '@/lib/blog/types';
import { blogDraftBodyEmbedsSourceList } from '@/lib/blog/blog-draft-body';
import { mapEditorRowsToPublicSources } from '@/lib/blog/public-post-sources';

const a = (index: number, url: string, title: string): BlogPostSourcePublic => ({
  index,
  title,
  publisher: 'nrk.no',
  url,
  publishedAt: null,
});

const previous = [
  a(1, 'https://www.nrk.no/1', 'En'),
  a(2, 'https://www.vg.no/2', 'To'),
  a(3, 'https://www.aftenposten.no/3', 'Tre'),
];

const reordered = [
  a(1, 'https://www.vg.no/2', 'To'),
  a(2, 'https://www.nrk.no/1', 'En'),
];

const remappedMove = remapBlogBodyCitations('Tekst [1] og [2].', previous, reordered);
assert.match(remappedMove, /\[2\].*\[1\]/);

const afterRemove = remapBlogBodyCitations('Før [2] og [3].', previous, [a(1, 'https://www.nrk.no/1', 'En')]);
assert.doesNotMatch(afterRemove, /\[2\]/);
assert.doesNotMatch(afterRemove, /\[3\]/);

const blockedPublic = mapEditorRowsToPublicSources([
  { title: 'Reddit', publisher: 'reddit.com', url: 'https://www.reddit.com/r/norge/x' },
  { title: 'NRK', publisher: 'nrk.no', url: 'https://www.nrk.no/ok' },
]);
assert.equal(blockedPublic.length, 1);
const withoutBlocked = remapBlogBodyCitations(
  'Sak [2]',
  [a(1, 'https://www.reddit.com/r/norge/x', 'Reddit'), a(2, 'https://www.nrk.no/ok', 'NRK')],
  blockedPublic,
);
assert.match(withoutBlocked, /\[1\]/);
assert.doesNotMatch(withoutBlocked, /\[2\]/);

const finalized = finalizeBlogDraftBodyWithSources(
  'Brødtekst [1].\n\n## Kilder\n\n1. test',
  previous,
  [a(1, 'https://www.nrk.no/1', 'En')],
);
assert.doesNotMatch(finalized, /^## Kilder/m);
assert.equal(blogDraftBodyEmbedsSourceList(finalized), false);

console.log('lib/blog/blog-citations.test.ts ok');