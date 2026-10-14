import assert from 'node:assert/strict';
import {
  STANCE_QUERY_PARAM,
  issueStanceFromPollChoice,
  opinionCreateStanceFromIssueStance,
  opinionCreateStanceFromPollChoice,
  opinionStanceFromIssueStance,
  parseOpinionCreateStanceParam,
  pollChoiceFromIssueStance,
} from './model';

assert.equal(issueStanceFromPollChoice('ja'), 'enig');
assert.equal(issueStanceFromPollChoice('nei'), 'uenig');
assert.equal(issueStanceFromPollChoice('blank'), null);

assert.equal(pollChoiceFromIssueStance('enig'), 'ja');
assert.equal(pollChoiceFromIssueStance('uenig'), 'nei');
assert.equal(pollChoiceFromIssueStance('ikke_interessert'), 'blank');

assert.equal(opinionStanceFromIssueStance('enig'), 'for');
assert.equal(opinionStanceFromIssueStance('uenig'), 'imot');
assert.equal(opinionStanceFromIssueStance('ikke_interessert'), 'blank');

assert.equal(opinionCreateStanceFromIssueStance('enig'), 'for');
assert.equal(opinionCreateStanceFromIssueStance('uenig'), 'imot');
assert.equal(opinionCreateStanceFromIssueStance('ikke_interessert'), null);

assert.equal(opinionCreateStanceFromPollChoice('ja'), 'for');
assert.equal(opinionCreateStanceFromPollChoice('nei'), 'imot');
assert.equal(opinionCreateStanceFromPollChoice('blank'), null);

// Blank vote must never produce 'ikke_interessert' issue stance
assert.notEqual(issueStanceFromPollChoice('blank'), 'ikke_interessert');

assert.equal(STANCE_QUERY_PARAM, 'standpunkt');
assert.equal(parseOpinionCreateStanceParam('for'), 'for');
assert.equal(parseOpinionCreateStanceParam('imot'), 'imot');
assert.equal(parseOpinionCreateStanceParam('blank'), null);
assert.equal(parseOpinionCreateStanceParam(undefined), null);

console.log('lib/stances/model.test.ts passed');
