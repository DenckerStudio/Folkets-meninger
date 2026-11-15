import assert from 'node:assert/strict';
import { mapPayloadPostToPublic, resolvePayloadPublishedAt } from '@/lib/cms/map-post';
import type { PayloadPost } from '@/lib/cms/types';

assert.equal(
  resolvePayloadPublishedAt({
    publishedAt: '2026-01-10T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  '2026-01-10T00:00:00.000Z',
);

assert.equal(
  resolvePayloadPublishedAt({
    publishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  '2026-01-01T00:00:00.000Z',
);

const mapped = mapPayloadPostToPublic({
  id: '5',
  slug: 'test',
  title: 'T',
  excerpt: 'E',
  bodyMarkdown: 'body',
  publishedAt: null,
  createdAt: '2026-03-15T12:00:00.000Z',
} as PayloadPost);

assert.equal(mapped.published_at, '2026-03-15T12:00:00.000Z');
assert.deepEqual(mapped.sources, []);

const withSources = mapPayloadPostToPublic({
  id: '6',
  slug: 'kilde-test',
  title: 'T',
  excerpt: 'E',
  bodyMarkdown: 'body',
  sources: [{ label: 'Artikkel (nrk.no)', url: 'https://www.nrk.no/1' }],
} as PayloadPost);
assert.equal(withSources.sources.length, 1);
assert.equal(withSources.sources[0]?.index, 1);

console.log('lib/cms/map-post.test.ts ok');
