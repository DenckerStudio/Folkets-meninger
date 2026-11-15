import assert from 'node:assert/strict';
import {
  applyHearingInnspillDraftToBody,
  hearingInnspillDraftNeedsConfirm,
} from './apply-draft';

assert.equal(hearingInnspillDraftNeedsConfirm(''), false);
assert.equal(hearingInnspillDraftNeedsConfirm('  '), false);
assert.equal(hearingInnspillDraftNeedsConfirm('Eksisterende'), true);

assert.equal(applyHearingInnspillDraftToBody('', 'Nytt', 'replace'), 'Nytt');
assert.equal(applyHearingInnspillDraftToBody('Gammelt', 'Nytt', 'replace'), 'Nytt');
assert.equal(applyHearingInnspillDraftToBody('Gammelt', 'Nytt', 'append'), 'Gammelt\n\nNytt');

console.log('hearing-innspill/apply-draft.test.ts: ok');