import assert from 'node:assert/strict';
import { getSourceSuggestionAccess } from './source-suggestion-access';

const locked = getSourceSuggestionAccess(4200);
assert.equal(locked.canSuggest, false);
assert.equal(locked.pointsNeeded, 800);

const veteran = getSourceSuggestionAccess(5200, 1);
assert.equal(veteran.canSuggest, true);
assert.equal(veteran.monthlyRemaining, 2);

console.log('source-suggestion-access tests passed');
