import assert from 'node:assert/strict';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import {
  loadBlogSitemapEntriesWithCmsFallback,
  mapBlogSlugsToSitemapEntries,
} from '@/lib/sitemap/blog-routes';

void (async () => {
  const base = 'https://folketsmeninger.no';

  const entries = mapBlogSlugsToSitemapEntries(base, [
    { slug: 'test', published_at: '2026-01-01T00:00:00.000Z', updated_at: null },
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.url, `${base}/blogg/test`);

  const logs: unknown[][] = [];
  const cmsError = await loadBlogSitemapEntriesWithCmsFallback(
    base,
    async () => {
      throw new CmsFetchError('feil', 'network');
    },
    { error: (...args: unknown[]) => logs.push(args) },
  );
  assert.deepEqual(cmsError, []);
  assert.equal(logs.length, 1);

  logs.length = 0;
  const genericError = await loadBlogSitemapEntriesWithCmsFallback(
    base,
    async () => {
      throw new Error('timeout');
    },
    { error: (...args: unknown[]) => logs.push(args) },
  );
  assert.deepEqual(genericError, []);
  assert.equal(logs.length, 1);

  const ok = await loadBlogSitemapEntriesWithCmsFallback(base, async () => [
    { slug: 'a', published_at: null, updated_at: null },
  ]);
  assert.equal(ok.length, 1);

  console.log('lib/sitemap/blog-routes.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
