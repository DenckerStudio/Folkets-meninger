import assert from 'node:assert/strict';
import {
  formatResearchTopicBriefError,
  researchTopicBriefErrorAllowsRetry,
  researchTopicBriefErrorShowsDeveloperHint,
  researchTopicBriefFailedMessage,
} from '@/lib/admin/research/topic-error-messages';

assert.equal(formatResearchTopicBriefError('modell_feil'), 'Språkmodellen svarte ikke');
assert.equal(formatResearchTopicBriefError('ugyldig_svar'), 'Svaret kunne ikke leses');
assert.equal(formatResearchTopicBriefError('henting_feil'), 'Kildesøket feilet');
assert.equal(formatResearchTopicBriefError('tema_mangler'), 'Temaet mangler eller er ufullstendig');
assert.equal(formatResearchTopicBriefError('something_else'), 'Noe gikk galt');

assert.match(researchTopicBriefFailedMessage('modell_feil'), /Prøv igjen/);
assert.match(researchTopicBriefFailedMessage('henting_feil'), /Kildesøket feilet/);
assert.match(researchTopicBriefFailedMessage('henting_feil'), /Prøv igjen/);
assert.equal(researchTopicBriefFailedMessage('tema_mangler'), 'Temaet mangler eller er ufullstendig');
assert.doesNotMatch(researchTopicBriefFailedMessage('tema_mangler'), /Prøv igjen/);

assert.equal(researchTopicBriefErrorAllowsRetry('tema_mangler'), false);
assert.equal(researchTopicBriefErrorAllowsRetry('henting_feil'), true);

assert.equal(researchTopicBriefErrorShowsDeveloperHint('ukjent_feil'), true);
assert.equal(researchTopicBriefErrorShowsDeveloperHint('modell_feil'), false);
assert.equal(researchTopicBriefErrorShowsDeveloperHint('something_else'), true);

console.log('lib/admin/research/topic-error-messages.test.ts: ok');
