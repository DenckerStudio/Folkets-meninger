import assert from 'node:assert/strict';
import {
  isActivePromptUniqueViolation,
  validatePromptSourceHeadlines,
  validatePromptVoteOptions,
} from './admin-prompt-validation';

assert.equal(
  validatePromptVoteOptions([{ id: 'ja', label: 'Ja' }]).ok,
  true,
);
assert.equal(
  validatePromptVoteOptions([{ id: 'avstemmes', label: 'X' }]).ok,
  false,
);
assert.equal(
  validatePromptSourceHeadlines([
    { title: 'Tittel', url: 'https://www.vg.no/a', outlet: 'VG' },
  ]).ok,
  true,
);
assert.equal(
  validatePromptSourceHeadlines([{ title: 'Mangler url', outlet: 'VG' }]).ok,
  false,
);
assert.equal(isActivePromptUniqueViolation({ code: '23505' }), true);
assert.equal(
  isActivePromptUniqueViolation({
    message: 'duplicate key value violates unique constraint "forum_prompts_active_question_unique"',
  }),
  true,
);

console.log('admin-prompt-validation tests passed');
