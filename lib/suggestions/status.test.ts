import assert from 'node:assert/strict';
import {
  isSuggestionStatus,
  suggestionStatusLabel,
} from '@/lib/suggestions/constants';

assert.equal(isSuggestionStatus('new'), true);
assert.equal(isSuggestionStatus('handled'), true);
assert.equal(isSuggestionStatus('open'), false);
assert.equal(suggestionStatusLabel('new'), 'Ny');
assert.equal(suggestionStatusLabel('handled'), 'Behandlet');

console.log('suggestions/status.test.ts: ok');
