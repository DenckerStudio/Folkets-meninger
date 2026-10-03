import assert from 'node:assert/strict';
import {
  RETTSSKRIVING_INSTRUCTION,
  isSpellingContext,
  runRettsskriving,
  runUpdatedSourceSearch,
  spellingContextLabel,
} from '@/lib/chat/actions';

assert.equal(isSpellingContext('diskusjon'), true);
assert.equal(isSpellingContext('ugyldig'), false);
assert.equal(spellingContextLabel('horing'), 'Høringsinnspill');

const tooShort = runRettsskriving({ draft: 'kort', context: 'annet' });
assert.equal(tooShort.ok, false);

const spelling = runRettsskriving({
  draft: 'Stortinget bør vurdere forslaget om klima.',
  context: 'diskusjon',
});
assert.equal(spelling.ok, true);
if (!spelling.ok) throw new Error('expected rettskriving ok');
assert.equal(spelling.result.published, false);
assert.equal(spelling.result.mode, 'instruction');
assert.equal(spelling.result.corrected, null);
assert.equal(spelling.result.notes, null);
assert.equal(spelling.result.original, 'Stortinget bør vurdere forslaget om klima.');
assert.equal(spelling.result.instruction, RETTSSKRIVING_INSTRUCTION);
assert.doesNotMatch(spelling.result.instruction, /publisert som innlegg/i);

async function main() {
  const emptyQuery = await runUpdatedSourceSearch('  ab  ');
  assert.equal(emptyQuery.ok, false);
  assert.equal(emptyQuery.unavailable, false);
  console.log('chat/actions.test.ts: ok');
}

void main();
