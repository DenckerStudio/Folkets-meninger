import assert from 'node:assert/strict';
import { formatVoteringRagSummary } from '@/lib/stortinget-votering-rag';
import {
  parsePartyStancesByVoteringFromExcerpts,
  reconcilePartyVoteClaimsWithSources,
  sentenceMentionsParty,
} from './party-vote-answer-guard';

const votering28432 = formatVoteringRagSummary('28432', 'Kontroll av drivstoffkjeder', {
  SV: 'for',
  H: 'mot',
});

const excerpts = [
  'Prop. om drivstoff og prissetting.',
  votering28432,
];

const parsed = parsePartyStancesByVoteringFromExcerpts(excerpts);
assert.equal(parsed.get('28432')?.get('SV'), 'for');

const contradictory =
  'I votering 28432 stemte SV for forslaget. I samme votering stemte SV mot forslaget. H stemte mot.';
const fixed = reconcilePartyVoteClaimsWithSources(contradictory, excerpts);
assert.match(fixed, /stemte SV for/i);
assert.ok(!/stemte SV mot/i.test(fixed));

const row037Like =
  'Kildene viser votering 28432 om drivstoffkjeder. SV stemte for, men SV stemte også mot i votering 28432.';
const fixed037 = reconcilePartyVoteClaimsWithSources(row037Like, excerpts);
assert.ok(!/stemte også mot/i.test(fixed037));
assert.match(fixed037, /SV stemte for|stemte SV for/i);

assert.equal(sentenceMentionsParty('v for olje og gass', 'V'), false);
assert.equal(sentenceMentionsParty('V stemte for i votering 28432', 'V'), true);
assert.equal(sentenceMentionsParty('h stemte mot', 'H'), false);
assert.equal(sentenceMentionsParty('H stemte mot', 'H'), true);

const multilineReconcile = reconcilePartyVoteClaimsWithSources(
  'Linje om votering 28432.\nI votering 28432 stemte SV for.\nSV stemte mot i votering 28432.',
  excerpts,
);
assert.equal(multilineReconcile.split('\n').length, 3);
assert.ok(!/stemte SV mot/i.test(multilineReconcile));

console.log('lib/chat/party-vote-answer-guard.test.ts ok');
