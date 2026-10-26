import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatVoteringRagSummary } from '@/lib/stortinget-votering-rag';
import {
  parsePartyStancesByVoteringFromExcerpts,
  reconcilePartyVoteClaimsWithSources,
  resolvePartyVoteGuardScope,
  sentenceMentionsParty,
  voteringIdsFromBracketCitations,
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
assert.equal(multilineReconcile.split('\n').length, 2);
assert.ok(!/stemte SV mot/i.test(multilineReconcile));

const guardCases = JSON.parse(
  readFileSync(
    new URL('../../test-fixtures/party-vote-guard-cases-023-037.json', import.meta.url),
    'utf8',
  ),
) as Array<{ id: string; answer: string; excerpts: string[] }>;

const row023 = guardCases.find((r) => r.id === 'v2-tema-023');
const row037 = guardCases.find((r) => r.id === 'v2-tema-037');
assert.ok(row023 && row037);

const out023 = reconcilePartyVoteClaimsWithSources(row023.answer, row023.excerpts);
assert.equal(out023, row023.answer, '023 must stay unchanged without votering id in text');
assert.match(out023, /\[2\]/);

const out037 = reconcilePartyVoteClaimsWithSources(row037.answer, row037.excerpts);
assert.match(out037, /votering 28432/i);
assert.match(out037, /\[6\]/);
const out037Before28433 = out037.split(/I votering 28433/)[0] ?? out037;
assert.ok(
  !/MDG og SV stemte mot/i.test(out037Before28433),
  'SV must not appear on mot side in 28432',
);
assert.match(out037Before28433, /Sp og SV for/i);

assert.deepEqual(resolvePartyVoteGuardScope(row023.answer, row023.excerpts), ['26802']);
assert.deepEqual(voteringIdsFromBracketCitations(row023.answer, row023.excerpts), ['26802']);

const noScopeAnswer =
  'Frp, Sp og Rødt stemte for, mens Arbeiderpartiet, Venstre, Høyre, KrF stemte mot.';
assert.equal(
  reconcilePartyVoteClaimsWithSources(noScopeAnswer, row023.excerpts),
  noScopeAnswer,
);

const wrongBullet = reconcilePartyVoteClaimsWithSources(
  'I votering 28432 stemte SV for.\n- H stemte for.',
  excerpts,
);
assert.ok(!wrongBullet.includes('H stemte for'));
assert.match(wrongBullet, /SV for/i);

console.log('lib/chat/party-vote-answer-guard.test.ts ok');
