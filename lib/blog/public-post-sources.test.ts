import assert from 'node:assert/strict';
import {
  blogCitationMapFromPostSources,
  mapPayloadSourcesToPublic,
} from '@/lib/blog/public-post-sources';

const mapped = mapPayloadSourcesToPublic([
  { label: 'Første (nrk.no, 2026-01-10)', url: 'https://www.nrk.no/1' },
  { label: 'Skjult Reddit', url: 'https://www.reddit.com/r/norge/comments/x' },
  { label: 'Andre (vg.no)', url: 'https://www.vg.no/2' },
]);

assert.equal(mapped.length, 2);
assert.equal(mapped[0]!.index, 1);
assert.equal(mapped[1]!.index, 2);
assert.equal(mapped[0]!.publishedAt, '2026-01-10');
assert.equal(mapped.some((row) => row.url.includes('reddit')), false);

const citationMap = blogCitationMapFromPostSources(mapped);
assert.equal(citationMap.get(1)?.href, 'https://www.nrk.no/1');
assert.equal(citationMap.get(2)?.external, true);

console.log('lib/blog/public-post-sources.test.ts ok');