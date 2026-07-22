import assert from 'node:assert/strict';
import {
  SAK_MENING_PREFIX,
  formatSakMeningQuestion,
  isSakMeningPrompt,
  validateSakMeningStatement,
} from './sak-mening';

assert.equal(formatSakMeningQuestion('Norge bør si ja'), `${SAK_MENING_PREFIX}Norge bør si ja`);
assert.equal(
  formatSakMeningQuestion('(Jeg mener) Norge bør si ja'),
  '(Jeg mener) Norge bør si ja',
);

const valid = validateSakMeningStatement('Norge bør si ja til forslaget');
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.question, `${SAK_MENING_PREFIX}Norge bør si ja til forslaget`);
}

const tooShort = validateSakMeningStatement('kort');
assert.equal(tooShort.ok, false);

assert.equal(isSakMeningPrompt(['sak_mening']), true);
assert.equal(isSakMeningPrompt(['nyheter']), false);

console.log('sak-mening tests passed');
