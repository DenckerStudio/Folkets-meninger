import assert from 'node:assert/strict';
import { parseCreateUserAnnotationBody, parseUpdateUserAnnotationBody } from '@/lib/user-annotations/validate';

const base = {
  target_type: 'sak' as const,
  target_id: '103102',
  container_key: 'official_description',
  quote: 'test',
  start_offset: 0,
  end_offset: 4,
};

const created = parseCreateUserAnnotationBody(base);
assert.equal(created.ok, true);

const badType = parseCreateUserAnnotationBody({ ...base, target_type: 'blog' });
assert.equal(badType.ok, false);

const badOffsets = parseCreateUserAnnotationBody({ ...base, start_offset: 5, end_offset: 4 });
assert.equal(badOffsets.ok, false);

const withNote = parseUpdateUserAnnotationBody({ note: '  Mitt notat  ' });
assert.equal(withNote.ok, true);
if (withNote.ok) {
  assert.equal(withNote.value.note, 'Mitt notat');
}

const clearNote = parseUpdateUserAnnotationBody({ note: '' });
assert.equal(clearNote.ok, true);
if (clearNote.ok) {
  assert.equal(clearNote.value.note, null);
}

console.log('user-annotations/validate.test.ts: ok');