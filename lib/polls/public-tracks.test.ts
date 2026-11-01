import assert from 'node:assert/strict';
import { isPublicAvstemningTrack, PUBLIC_AVSTEMNING_TRACKS } from './public-tracks';

assert.deepEqual(PUBLIC_AVSTEMNING_TRACKS, ['stortinget']);
assert.equal(isPublicAvstemningTrack('stortinget'), true);
assert.equal(isPublicAvstemningTrack('system'), false);
assert.equal(isPublicAvstemningTrack('citizen'), false);

console.log('lib/polls/public-tracks.test.ts: ok');
