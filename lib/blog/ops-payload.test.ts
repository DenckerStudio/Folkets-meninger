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

const longBluesky = parseCreateBlogDraftBody({
  ...base,
  bluesky_text: '🙂'.repeat(400),
});
assert.equal(longBluesky.ok, false);

const social = parseSocialPostedBody({ slug: 'test-innlegg', bluesky_uri: 'at://x' });
assert.equal(social.ok, true);

console.log('lib/blog/ops-payload.test.ts ok');
