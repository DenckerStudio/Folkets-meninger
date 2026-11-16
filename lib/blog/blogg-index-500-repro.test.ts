import assert from 'node:assert/strict';
import { CmsFetchError } from '@/lib/cms/cms-fetch-error';
import { blogCmsOrUnavailable } from '@/lib/blog/cms-read-runtime';
import { mapPayloadPostToPublic } from '@/lib/cms/map-post';
import type { PayloadPost } from '@/lib/cms/types';

/**
 * Dokumenterer mapping på /blogg side 1 (featured-parallell lesing).
 * CMS-listefeil skal propagere til blogCmsOrUnavailable (se blogg-cms-list-unavailable.test.ts).
 */

function legacyEstimateReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

assert.throws(
  () => legacyEstimateReadingMinutes(undefined as unknown as string),
  TypeError,
  'manglende bodyMarkdown krasjet estimateReadingMinutes før robust mapping',
);

assert.doesNotThrow(() =>
  mapPayloadPostToPublic({
    id: '71',
    slug: 'eksempel',
    title: 'T',
    excerpt: 'E',
  } as PayloadPost),
);

void (async () => {
  const cmsDown = await blogCmsOrUnavailable(async () => {
    throw new CmsFetchError('http', 'http');
  });
  assert.deepEqual(cmsDown, { unavailable: true });

  console.log('lib/blog/blogg-index-500-repro.test.ts ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});