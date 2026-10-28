import assert from 'node:assert/strict';
import {
  PAYLOAD_PATCH_ID_MISMATCH,
  PAYLOAD_PATCH_INVALID_RESPONSE,
  parsePayloadPatchPostResponse,
} from '@/lib/cms/payload-update';

const post = {
  id: 'post-42',
  title: 'Tittel',
  excerpt: 'Ingress',
  bodyMarkdown: 'Brødtekst',
  slug: 'tittel',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

const direct = parsePayloadPatchPostResponse('post-42', post);
assert.equal(direct.ok, true);
if (direct.ok) {
  assert.equal(direct.doc.id, 'post-42');
  assert.equal(direct.doc.bodyMarkdown, 'Brødtekst');
}

const wrapped = parsePayloadPatchPostResponse('post-42', {
  doc: post,
  message: 'Updated successfully.',
});
assert.equal(wrapped.ok, true);
if (wrapped.ok) {
  assert.equal(wrapped.doc.title, 'Tittel');
}

const mismatch = parsePayloadPatchPostResponse('post-42', {
  doc: { ...post, id: 'other-id' },
});
assert.equal(mismatch.ok, false);
if (!mismatch.ok) {
  assert.equal(mismatch.error, PAYLOAD_PATCH_ID_MISMATCH);
}

const envelopeOnly = parsePayloadPatchPostResponse('post-42', {
  message: 'Updated successfully.',
});
assert.equal(envelopeOnly.ok, false);
if (!envelopeOnly.ok) {
  assert.equal(envelopeOnly.error, PAYLOAD_PATCH_INVALID_RESPONSE);
}

const undefinedId = parsePayloadPatchPostResponse('post-42', {
  doc: { title: 'Uten id' },
});
assert.equal(undefinedId.ok, false);

console.log('lib/cms/payload-update.test.ts ok');
