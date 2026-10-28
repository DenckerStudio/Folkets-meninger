import assert from 'node:assert/strict';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';
import {
  mapApiFieldErrors,
  validateBlogDraftEditContent,
} from '@/lib/admin/blog-draft-edit-fields';
import { parseEditBlogDraftBody } from '@/lib/admin/blog-draft-edit';

const valid = {
  title: 'Tittel',
  excerpt: 'Ingress',
  bodyMarkdown: '## Avsnitt\n\nTekst.',
};

assert.equal(validateBlogDraftEditContent(valid).ok, true);

const emptyTitle = validateBlogDraftEditContent({ ...valid, title: '   ' });
assert.equal(emptyTitle.ok, false);
if (!emptyTitle.ok) {
  assert.equal(emptyTitle.fields.title, 'Tittel er påkrevd.');
}

const longTitle = validateBlogDraftEditContent({
  ...valid,
  title: 'x'.repeat(BLOG_TITLE_MAX + 1),
});
assert.equal(longTitle.ok, false);
if (!longTitle.ok) {
  assert.match(longTitle.fields.title ?? '', /110 tegn/);
}

const longExcerpt = validateBlogDraftEditContent({
  ...valid,
  excerpt: 'y'.repeat(BLOG_EXCERPT_MAX + 1),
});
assert.equal(longExcerpt.ok, false);

const emptyBody = validateBlogDraftEditContent({ ...valid, bodyMarkdown: '   ' });
assert.equal(emptyBody.ok, false);
if (!emptyBody.ok) {
  assert.ok(emptyBody.fields.bodyMarkdown);
}

assert.deepEqual(
  mapApiFieldErrors({ title: 'Feil tittel', excerpt: 42, other: 'x' }),
  { title: 'Feil tittel.' },
);

assert.deepEqual(mapApiFieldErrors({ excerpt: 'Allerede med punktum.' }), {
  excerpt: 'Allerede med punktum.',
});

const apiShape = parseEditBlogDraftBody({
  id: 'post-1',
  action: 'edit',
  title: '',
  excerpt: '   ',
  bodyMarkdown: '',
});
assert.equal(apiShape.ok, false);
if (!apiShape.ok) {
  assert.ok(apiShape.fields);
  assert.equal(typeof apiShape.fields?.title, 'string');
  assert.equal(typeof apiShape.fields?.excerpt, 'string');
  assert.equal(typeof apiShape.fields?.bodyMarkdown, 'string');
  assert.match(apiShape.error, /\.$/);
}

console.log('lib/admin/blog-draft-edit-fields.test.ts ok');
