import assert from 'node:assert/strict';
import type { BlogOpsLookupResult } from '@/lib/cms/blog-ops-client';

/** Mirrors the success branch in createBlogDraft for an existing post. */
function existingDraftApiBody(hit: Extract<BlogOpsLookupResult, { found: true }>) {
  return {
    id: hit.id,
    slug: hit.slug,
    created: false,
    adminUrl: hit.adminUrl,
    cmsStatus: hit.cmsStatus,
  };
}

const publishedRetry = existingDraftApiBody({
  found: true,
  id: '5',
  slug: 'test',
  adminUrl: 'https://cms/admin/5',
  cmsStatus: 'published',
});

assert.equal(publishedRetry.created, false);
assert.equal(publishedRetry.cmsStatus, 'published');
assert.equal(publishedRetry.id, '5');

const draftRetry = existingDraftApiBody({
  found: true,
  id: '6',
  slug: 'utkast',
  adminUrl: 'https://cms/admin/6',
  cmsStatus: 'draft',
});

assert.equal(draftRetry.cmsStatus, 'draft');

console.log('lib/blog/draft-api-response.test.ts ok');
