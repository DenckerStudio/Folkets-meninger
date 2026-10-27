import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOG_DRAFT_EDIT_NOT_CONFIGURED,
  editBlogDraft,
  parseEditBlogDraftBody,
} from '@/lib/admin/blog-draft-edit';

const envSnapshot = {
  CMS_URL: process.env.CMS_URL,
  CMS_EDITOR_API_KEY: process.env.CMS_EDITOR_API_KEY,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value === undefined) delete process.env[key as keyof typeof envSnapshot];
    else process.env[key as keyof typeof envSnapshot] = value;
  }
}

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/blog-drafts/route.ts'),
  'utf8',
);
assert.match(routeSrc, /editEnabled: isBlogDraftEditConfigured\(\)/);
assert.match(routeSrc, /parsed\.fields/);

const invalidBody = parseEditBlogDraftBody(null);
assert.equal(invalidBody.ok, false);
if (!invalidBody.ok) {
  assert.equal(invalidBody.error, 'Ugyldig forespørsel.');
}

void (async () => {
  process.env.CMS_URL = 'https://cms.example.test';
  delete process.env.CMS_EDITOR_API_KEY;

  const missingKey = await editBlogDraft({
    id: 'post-1',
    action: 'edit',
    title: 'Tittel',
    excerpt: 'Ingress',
    bodyMarkdown: 'Tekst.',
  });
  assert.equal(missingKey.ok, false);
  if (!missingKey.ok) {
    assert.equal(missingKey.status, 503);
    assert.equal(missingKey.error, BLOG_DRAFT_EDIT_NOT_CONFIGURED);
    assert.match(missingKey.error, /\.$/);
  }

  restoreEnv();
  console.log('lib/admin/blog-drafts-api.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
