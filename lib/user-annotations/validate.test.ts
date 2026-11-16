import assert from 'node:assert/strict';
import { parseCreateUserAnnotationBody, parseUpdateUserAnnotationBody } from '@/lib/user-annotations/validate';

const base = {
  target_type: 'research' as const,
  target_id: 'cluster-1',
  container_key: 'research_latest_summary',
  quote: 'test',
  start_offset: 0,
  end_offset: 4,
  flag_type: 'faktasjekk' as const,
};

const created = parseCreateUserAnnotationBody(base);
assert.equal(created.ok, true);

const sakRejected = parseCreateUserAnnotationBody({ ...base, target_type: 'sak' });
assert.equal(sakRejected.ok, false);

const badType = parseCreateUserAnnotationBody({ ...base, target_type: 'blog' });
assert.equal(badType.ok, false);

const badFlag = parseCreateUserAnnotationBody({ ...base, flag_type: 'blog' });
assert.equal(badFlag.ok, false);

const badOffsets = parseCreateUserAnnotationBody({ ...base, start_offset: 5, end_offset: 4 });
assert.equal(badOffsets.ok, false);

const withNote = parseUpdateUserAnnotationBody({ note: '  Mitt notat  ' });
assert.equal(withNote.ok, true);
if (withNote.ok) {
  assert.equal(withNote.value.note, 'Mitt notat');
}

const withFlag = parseUpdateUserAnnotationBody({ flag_type: 'sporsmal' });
assert.equal(withFlag.ok, true);
if (withFlag.ok) {
  assert.equal(withFlag.value.flag_type, 'sporsmal');
}

const clearNote = parseUpdateUserAnnotationBody({ note: '' });
assert.equal(clearNote.ok, true);
if (clearNote.ok) {
  assert.equal(clearNote.value.note, null);
}

console.log('user-annotations/validate.test.ts: ok');