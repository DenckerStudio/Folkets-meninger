import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOG_DRAFT_EDIT_NOT_CONFIGURED,
  buildEditBlogDraftPatch,
  editBlogDraft,
  parseEditBlogDraftBody,
} from '@/lib/admin/blog-draft-edit';
import { getCmsEditorKey } from '@/lib/cms/payload-client';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';

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

const validEdit = {
  id: 'post-1',
  action: 'edit' as const,
  title: 'Tittel',
  excerpt: 'Ingress',
  bodyMarkdown: '## Avsnitt\n\nTekst.',
};

const tooLongTitle = 'x'.repeat(BLOG_TITLE_MAX + 1);
const tooLongExcerpt = 'y'.repeat(BLOG_EXCERPT_MAX + 1);

assert.equal(parseEditBlogDraftBody(validEdit).ok, true);

const missingTitle = parseEditBlogDraftBody({ ...validEdit, title: '   ' });
assert.equal(missingTitle.ok, false);
if (!missingTitle.ok) assert.equal(missingTitle.status, 400);

const longTitle = parseEditBlogDraftBody({ ...validEdit, title: tooLongTitle });
assert.equal(longTitle.ok, false);

const longExcerpt = parseEditBlogDraftBody({ ...validEdit, excerpt: tooLongExcerpt });
assert.equal(longExcerpt.ok, false);

const emptyBody = parseEditBlogDraftBody({ ...validEdit, bodyMarkdown: '   ' });
assert.equal(emptyBody.ok, false);

const publishAttempt = parseEditBlogDraftBody({ ...validEdit, _status: 'published' });
assert.equal(publishAttempt.ok, false);
if (!publishAttempt.ok) {
  assert.match(publishAttempt.error, /publisere/i);
}

const patch = buildEditBlogDraftPatch({
  ...validEdit,
  category: 'cat-99',
  review: { note: 'Merknad' },
});
assert.deepEqual(patch, {
  title: validEdit.title,
  excerpt: validEdit.excerpt,
  bodyMarkdown: validEdit.bodyMarkdown,
  category: 'cat-99',
  review: { note: 'Merknad' },
});
assert.equal('_status' in patch, false);
assert.equal('origin' in patch, false);
assert.equal('sourceEvent' in patch, false);

const routeSrc = readFileSync(
  join(process.cwd(), 'app/api/admin/blog-drafts/route.ts'),
  'utf8',
);
assert.match(routeSrc, /requireAdmin\(\)/);
assert.match(routeSrc, /parseEditBlogDraftBody/);
assert.match(routeSrc, /editBlogDraft/);
assert.match(routeSrc, /action === 'edit'/);

const editorKeyFn = readFileSync(join(process.cwd(), 'lib/cms/payload-client.ts'), 'utf8');
const editorKeyBlock = editorKeyFn.match(
  /export function getCmsEditorKey\(\)[\s\S]*?^}/m,
)?.[0];
assert.ok(editorKeyBlock);
assert.match(editorKeyBlock!, /CMS_EDITOR_API_KEY/);
assert.doesNotMatch(editorKeyBlock!, /CMS_API_KEY/);
assert.doesNotMatch(editorKeyBlock!, /CMS_AGENT_API_KEY/);

void (async () => {
  process.env.CMS_URL = 'https://cms.example.test';
  delete process.env.CMS_EDITOR_API_KEY;
  assert.equal(getCmsEditorKey(), null);

  const missingKey = await editBlogDraft(validEdit);
  assert.equal(missingKey.ok, false);
  if (!missingKey.ok) {
    assert.equal(missingKey.status, 503);
    assert.equal(missingKey.error, BLOG_DRAFT_EDIT_NOT_CONFIGURED);
  }

  restoreEnv();
  console.log('lib/admin/blog-draft-edit.test.ts ok');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
