import assert from 'node:assert/strict';
import {
  formatPayloadValidationMessage,
  parsePayloadCreatePostResponse,
} from '@/lib/cms/payload-create';

const wrapped = parsePayloadCreatePostResponse({
  doc: { id: 5, slug: 'test-slug', _status: 'draft' },
  message: 'ok',
});
assert.ok(wrapped);
assert.equal(wrapped?.id, '5');
assert.equal(wrapped?.slug, 'test-slug');
assert.equal(wrapped?._status, 'draft');

const flat = parsePayloadCreatePostResponse({ id: '7', slug: 'flat' });
assert.ok(flat);
assert.equal(flat?.id, '7');

assert.equal(parsePayloadCreatePostResponse({ doc: { slug: 'x' } }), null);

const validation = formatPayloadValidationMessage({
  errors: [{ path: 'title', message: 'Verdien er for lang' }],
});
assert.equal(validation, 'title: Verdien er for lang');

const messageOnly = formatPayloadValidationMessage({ message: 'Validation failed' });
assert.equal(messageOnly, 'Validation failed');

console.log('lib/cms/payload-create.test.ts ok');
