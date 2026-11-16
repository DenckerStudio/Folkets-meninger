import assert from 'node:assert/strict';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import { blogCmsOrUnavailable } from '@/lib/blog/cms-read-runtime';

/**
 * listPublishedBlogPostsPaginated skal kaste ved CMS-feil — ikke returnere tom side —
 * slik at blogCmsOrUnavailable viser unavailable-shellet (ikke «Ingen artikler ennå»).
 */
void (async () => {
  const listFails = await blogCmsOrUnavailable(async () => {
    throw new CmsFetchError('CMS returnerte HTTP 503', 'http');
  });
  assert.deepEqual(listFails, { unavailable: true });
  assert.notDeepEqual(listFails, {
    unavailable: false,
    data: { posts: [], totalPages: 0, categories: [], featured: null },
  });

  const viaLoader = await blogCmsOrUnavailable(async () => {
    throw new CmsFetchError('CMS forespørsel feilet', 'network');
  });
  assert.deepEqual(viaLoader, { unavailable: true });

  console.log('lib/blog/blogg-cms-list-unavailable.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});