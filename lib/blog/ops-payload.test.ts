import assert from 'node:assert/strict';
import { parseCreateBlogDraftBody, parseSocialPostedBody } from '@/lib/blog/ops-payload';

const base = {
  slug: 'test-innlegg',
  title: 'Tittel',
  excerpt: 'Kort ingress',
  body_md: 'Avsnitt',
};

const ok = parseCreateBlogDraftBody(base);
assert.equal(ok.ok, true);
if (ok.ok) {
  assert.equal(ok.input.excerpt, 'Kort ingress');
  assert.ok(ok.input.bluesky_text);
}

const longExcerpt = parseCreateBlogDraftBody({
  ...base,
  excerpt: 'a'.repeat(301),
});
assert.equal(longExcerpt.ok, false);

const longTitle = parseCreateBlogDraftBody({
  ...base,
  title: 'a'.repeat(111),
});
assert.equal(longTitle.ok, false);

const longBluesky = parseCreateBlogDraftBody({
  ...base,
  bluesky_text: '🙂'.repeat(400),
});
assert.equal(longBluesky.ok, false);

const researchBlog = parseCreateBlogDraftBody({
  ...base,
  category: 'forklart',
  source_event: 'research:550e8400-e29b-41d4-a716-446655440000',
  review_note: 'Fra research-utkast',
});
assert.equal(researchBlog.ok, true);
if (researchBlog.ok) {
  assert.equal(researchBlog.input.category, 'forklart');
  assert.equal(researchBlog.input.source_event, 'research:550e8400-e29b-41d4-a716-446655440000');
  assert.equal(researchBlog.input.review_note, 'Fra research-utkast');
}

const social = parseSocialPostedBody({ slug: 'test-innlegg', bluesky_uri: 'at://x' });
assert.equal(social.ok, true);

console.log('lib/blog/ops-payload.test.ts ok');
