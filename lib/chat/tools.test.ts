import assert from 'node:assert/strict';
import { createChatTools } from './tools';
import { collectPollResults, shapeChatPollResults } from './poll-tools';
import { collectImpact, collectMyActivity, collectPublicProfile } from './personal-tools';
import {
  matchPolitikere,
  shapeChatHearing,
  shapeSakDocumentGroups,
  shapeSakTimeline,
} from './stortinget-tools';
import type { PolitikerOversikt, StortingetSakDetail } from '@/lib/stortinget';
import type { PollRecord } from '@/lib/polls/types';

async function main() {
  const tools = createChatTools('1234');
  assert.equal(typeof tools.retrieveSakContext.execute, 'function');
  assert.equal(typeof tools.retrieveTopicContext.execute, 'function');
  assert.equal(typeof tools.getVoteResults.execute, 'function');
  assert.equal(typeof tools.findHearingsForSak.execute, 'function');
  assert.equal(typeof tools.listOpenHearings.execute, 'function');
  assert.equal(typeof tools.getSakTimeline.execute, 'function');
  assert.equal(typeof tools.listSakDocuments.execute, 'function');
  assert.equal(typeof tools.getFolketsMeninger.execute, 'function');
  assert.equal(typeof tools.getPolitician.execute, 'function');
  assert.equal(typeof tools.getPollResults.execute, 'function');
  assert.equal(typeof tools.getMyActivity.execute, 'function');
  assert.equal(typeof tools.getImpact.execute, 'function');
  assert.equal(typeof tools.getPublicProfile.execute, 'function');

  // Options object form keeps the string form working (phase 1 callers).
  const withOptions = createChatTools({ preferredIssueId: '1234', userId: 'user-1' });
  assert.equal(typeof withOptions.getMyActivity.execute, 'function');
  assert.equal(typeof withOptions.getPollResults.execute, 'function');

  // Personal tools fail closed without a session-derived user id.
  const noSessionActivity = await collectMyActivity(null);
  assert.equal(noSessionActivity.found, false);
  assert.equal(noSessionActivity.signedIn, false);
  const noSessionProfile = await collectPublicProfile(null, null);
  assert.equal(noSessionProfile.found, false);
  assert.equal(noSessionProfile.signedIn, false);
  const noIssueImpact = await collectImpact({
    resolveIssueId: async () => null,
    profile: { fylkeCode: null, housing: null, hasCar: null, occupation: null },
  });
  assert.equal(noIssueImpact.found, false);
  assert.equal(noIssueImpact.result, null);

  // Poll shaping is pure and derives percentages from aggregate counts.
  const poll: PollRecord = {
    id: 'poll-1',
    track: 'system',
    status: 'open',
    title: 'Bør Norge øke vektgrensen?',
    neutralSummary: 'Kort nøytral oppsummering.',
    sourceUrls: [],
    stortingetIssueId: null,
    citizenInitiativeId: null,
    opensAt: null,
    closesAt: null,
    createdAt: '2099-01-01T00:00:00Z',
    generationMetadata: {},
  };
  const shaped = shapeChatPollResults({
    poll,
    totals: { ja: 3, nei: 1, blank: 0, total: 4 },
  });
  assert.equal(shaped.found, true);
  assert.equal(shaped.isOpen, true);
  assert.equal(shaped.percents.ja, 75);
  assert.equal(shaped.percents.nei, 25);
  assert.equal(shaped.percents.blank, 0);
  assert.equal(shaped.note, null);

  const emptyShaped = shapeChatPollResults({ poll: null });
  assert.equal(emptyShaped.found, false);
  assert.equal(emptyShaped.pollId, null);
  assert.ok(emptyShaped.note);

  // With no poll/issue/query, collection returns the honest empty shape.
  const noPoll = await collectPollResults({ resolveIssueId: async () => null });
  assert.equal(noPoll.found, false);

  const spelling = await tools.helpRettsskriving.execute(
    {
      draft: 'Stortinget bør vurdere forslaget om klima.',
      context: 'diskusjon',
    },
    { toolCallId: 't1', messages: [], abortSignal: undefined as never },
  );

  assert.equal(spelling.original, 'Stortinget bør vurdere forslaget om klima.');
  assert.equal(spelling.context, 'diskusjon');
  assert.equal(spelling.mode, 'instruction');
  assert.equal(spelling.corrected, null);
  assert.match(spelling.instruction, /rettskriving|stavemåte|grammatikk/i);
  assert.doesNotMatch(spelling.instruction, /generer et ferdig innlegg som om det var publisert/i);

  const hearing = shapeChatHearing({
    id: '99',
    horing_status: 'Aktiv',
    innspillsfrist: '2099-03-15',
    komite: { navn: 'Justiskomiteen' },
    horing_sak_info_liste: [
      { sak_id: 123, sak_tittel: 'Test sak', sak_henvisning: 'Dok 8:1 S' },
    ],
  });
  assert.equal(hearing.id, '99');
  assert.equal(hearing.title, 'Test sak');
  assert.equal(hearing.statusKind, 'open');
  assert.equal(hearing.statusLabel, 'Åpen for innspill');
  assert.equal(hearing.committee, 'Justiskomiteen');
  assert.ok(hearing.deadline);
  assert.ok(hearing.skriftligInnspillUrl.includes('h=99'));

  const sentinel = shapeChatHearing({
    id: '100',
    horing_status: 'Aktiv',
    innspillsfrist: '/Date(-62135596800000)/',
    horing_sak_info_liste: [{ sak_tittel: 'Uten frist' }],
  });
  assert.equal(sentinel.deadline, null);
  assert.equal(sentinel.deadlineLabel, 'Ingen frist oppgitt');

  const timeline = shapeSakTimeline(
    {
      id: 5,
      korttittel: 'Test sak',
      ferdigbehandlet: false,
      status: 1,
      saksgang: {
        saksgang_steg_liste: [
          {
            navn: 'Komitébehandling',
            saksgang_hendelse_liste: [{ id: 'VOT', dato: '15.05.2099', hendelse_tekst: 'Votering' }],
          },
        ],
      },
    } as StortingetSakDetail,
    new Date('2099-01-01T00:00:00Z'),
  );
  assert.equal(timeline.steps.length, 1);
  assert.equal(timeline.steps[0].events[0].id, 'VOT');
  assert.equal(timeline.voting.isOpen, true);
  assert.equal(timeline.statusLabel, 'Under behandling');

  const documents = shapeSakDocumentGroups({
    publikasjon_referanse_liste: [
      { eksport_id: 'prop-1', lenke_tekst: 'Prop. 1 L', lenke_url: '//stortinget.no/x', type: 1 },
    ],
  } as StortingetSakDetail);
  assert.equal(documents.total, 1);
  assert.equal(documents.groups[0].kind, 'lovforslag');
  assert.equal(documents.groups[0].documents[0].sourceUrl, 'https://stortinget.no/x');

  const roster = [
    {
      id: 'A',
      fornavn: 'Kari',
      etternavn: 'Nordmann',
      fylke: { navn: 'Oslo' },
      parti: { id: '1', navn: 'Arbeiderpartiet' },
      erRegjeringsmedlem: false,
    },
    {
      id: 'B',
      fornavn: 'Ola',
      etternavn: 'Nordmann',
      fylke: { navn: 'Vestland' },
      parti: { id: '2', navn: 'Høyre' },
      erRegjeringsmedlem: true,
      tittel: 'Statsminister',
    },
  ] as PolitikerOversikt[];

  assert.equal(matchPolitikere(roster, { query: 'nordmann' }).matches.length, 2);
  const byId = matchPolitikere(roster, { personId: 'B' });
  assert.equal(byId.matches[0].name, 'Ola Nordmann');
  assert.equal(byId.matches[0].parti, 'Høyre');
  assert.equal(byId.matches[0].erRegjeringsmedlem, true);
  assert.equal(matchPolitikere(roster, { query: '' }).matches.length, 0);

  console.log('chat/tools.test.ts: ok');
}

void main();
