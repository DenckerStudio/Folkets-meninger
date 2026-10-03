import assert from 'node:assert/strict';
import {
  isRoadmapStatus,
  isSuggestionAudience,
  isSuggestionCategory,
  isSuggestionStatus,
  isSuggestionVote,
  roadmapStatusLabel,
  suggestionAudienceLabel,
  suggestionCategoryLabel,
  suggestionStatusLabel,
} from '@/lib/appens-fremtid/constants';

assert.equal(isSuggestionStatus('new'), true);
assert.equal(isSuggestionStatus('handled'), true);
assert.equal(isSuggestionStatus('open'), false);
assert.equal(suggestionStatusLabel('new'), 'Ny');
assert.equal(suggestionStatusLabel('handled'), 'Behandlet');

assert.equal(isSuggestionCategory('funksjon'), true);
assert.equal(isSuggestionAudience('meg'), true);
assert.equal(isSuggestionVote('up'), true);
assert.equal(isRoadmapStatus('in_progress'), true);
assert.equal(suggestionCategoryLabel('feil'), 'Feil');
assert.equal(suggestionAudienceLabel('alle'), 'Alle');
assert.equal(roadmapStatusLabel('planned'), 'Planlagt');
assert.equal(roadmapStatusLabel('in_progress'), 'Under arbeid');
assert.equal(roadmapStatusLabel('done'), 'Ferdig');

console.log('appens-fremtid/status.test.ts: ok');
