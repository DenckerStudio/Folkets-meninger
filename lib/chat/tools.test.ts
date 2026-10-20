import assert from 'node:assert/strict';
import { createChatTools } from './tools';
import { collectPollResults, shapeChatPollResults } from './poll-tools';
import {
  collectImpact,
  collectInnspillStatus,
  collectMyActivity,
  collectMyNotifications,
  collectPublicProfile,
  gateImpactAmounts,
} from './personal-tools';
import type { ImpactResult } from '@/lib/impact/types';
import type { OpinionInnspillRecord } from '@/lib/innspill/types';
import {
  matchPolitikere,
  parseSaksgangEventDate,
  hearingsFromSaksgang,
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
  assert.equal(typeof tools.listMyNotifications.execute, 'function');
  assert.equal(typeof tools.getInnspillStatus.execute, 'function');

  // Dropped duplicates must not come back.
  for (const dropped of [
    'calculateSakImpact',
    'getMyProfile',
    'getMyStanceSignals',
    'getOpinionsForSak',
    'getOfficialInnspillLink',
  ]) {
    assert.ok(!(dropped in tools), `${dropped} should not be registered`);
  }

  // No personal tool may take a user id or profile as a model argument.
  for (const name of ['getMyActivity', 'getImpact', 'getPublicProfile', 'listMyNotifications', 'getInnspillStatus'] as const) {
    const shape = (tools[name].inputSchema as { shape?: Record<string, unknown> }).shape ?? {};
    assert.ok(!('userId' in shape), `${name} must not accept userId`);
    assert.ok(!('impactProfile' in shape), `${name} must not accept impactProfile`);
  }

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
  assert.equal(noIssueImpact.confidence, null);
  assert.equal(noIssueImpact.source, null);

  // getMyActivity: logged out still returns an (empty) stances section.
  assert.deepEqual(noSessionActivity.stanceSignals, { categories: [], labels: [] });

  // getImpact: kroner only survive when grounded in sak documents.
  const baseImpact: ImpactResult = {
    headline: 'h',
    personalSummary: 's',
    annualAmountKr: 1200,
    direction: 'increase',
    amountKind: 'tax',
    confidence: 'medium',
    effects: [
      {
        id: 'e1',
        title: 'Avgift',
        summary: 'x',
        appliesToUser: true,
        audience: 'car_owner',
        audienceLabel: 'Bileier',
        direction: 'increase',
        annualAmountKr: 1200,
        amountKind: 'tax',
        evidence: '1 200 kr',
      },
    ],
    grounded: true,
    sourcesUsed: 2,
    whoAffected: null,
    howAffected: null,
    disclaimer: 'd',
  };
  const fromDocs = gateImpactAmounts(baseImpact);
  assert.equal(fromDocs.result.annualAmountKr, 1200);
  assert.equal(fromDocs.source.kind, 'sak-dokumenter');
  assert.equal(fromDocs.source.amountFromDocuments, true);
  const guessed = gateImpactAmounts({ ...baseImpact, sourcesUsed: 0 });
  assert.equal(guessed.result.annualAmountKr, null);
  assert.equal(guessed.result.effects[0].annualAmountKr, null);
  assert.equal(guessed.source.amountFromDocuments, false);
  assert.equal(guessed.result.confidence, 'medium');
  const ungrounded = gateImpactAmounts({ ...baseImpact, grounded: false, sourcesUsed: 0 });
  assert.equal(ungrounded.source.kind, 'ingen');
  assert.equal(ungrounded.result.annualAmountKr, null);

  // listMyNotifications: fail closed without session, scoped to own user id.
  const noSessionNotifications = await collectMyNotifications(null, null);
  assert.equal(noSessionNotifications.signedIn, false);
  assert.deepEqual(noSessionNotifications.items, []);
  const eqCalls: Array<[string, unknown]> = [];
  const fakeQuery = {
    select: () => fakeQuery,
    eq: (column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return fakeQuery;
    },
    order: () => fakeQuery,
    limit: () => fakeQuery,
    is: () => fakeQuery,
    then: (resolve: (value: unknown) => void) =>
      resolve({
        data: [
          {
            id: 'n1',
            title: 'Ny sak',
            body: null,
            url: '/sak/1',
            channel: 'in_app',
            created_at: '2099-01-01T00:00:00Z',
            read_at: null,
          },
          {
            id: 'n1',
            title: 'Ny sak',
            body: null,
            url: '/sak/1',
            channel: 'in_app',
            created_at: '2099-01-01T00:00:00Z',
            read_at: null,
          },
        ],
        error: null,
      }),
  };
  const fakeClient = { from: () => fakeQuery } as unknown as Parameters<typeof collectMyNotifications>[0];
  const notifications = await collectMyNotifications(fakeClient, 'user-1');
  assert.equal(notifications.found, true);
  assert.equal(notifications.items.length, 1, 'duplicate notification rows must dedupe by id');
  assert.equal(notifications.items[0].title, 'Ny sak');
  assert.equal(notifications.items[0].read, false);
  assert.deepEqual(eqCalls, [['user_id', 'user-1']]);

  // getInnspillStatus: only the author's own innspill is returned.
  const record: OpinionInnspillRecord = {
    opinionId: 'op-1',
    authorUserId: 'user-1',
    authorName: null,
    status: 'gathering',
    supportThreshold: 10,
    supportCount: 3,
    stortingetHearingId: null,
    hearingDeadlineAt: null,
    packagedAt: null,
    createdAt: '2099-01-01T00:00:00Z',
  } as OpinionInnspillRecord;
  const load = async () => record;
  const own = await collectInnspillStatus('user-1', 'op-1', load);
  assert.equal(own.found, true);
  assert.equal(own.supportCount, 3);
  const other = await collectInnspillStatus('user-2', 'op-1', load);
  assert.equal(other.found, false);
  assert.equal(other.supportCount, null);
  const loggedOut = await collectInnspillStatus(null, 'op-1', load);
  assert.equal(loggedOut.signedIn, false);

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
    totals: { ja: 15, nei: 5, blank: 0, total: 20 },
  });
  assert.equal(shaped.found, true);
  assert.equal(shaped.isOpen, true);
  assert.equal(shaped.percents.ja, 75);
  assert.equal(shaped.percents.nei, 25);
  assert.equal(shaped.percents.blank, 0);
  assert.equal(shaped.note, null);

  const belowMin = shapeChatPollResults({
    poll,
    totals: { ja: 3, nei: 1, blank: 0, total: 4 },
  });
  assert.equal(belowMin.percents.ja, 0);
  assert.match(belowMin.note ?? '', /Færre enn/);

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
  assert.equal(hearing.skriftligInnspillUrl?.includes('h=99'), true);

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

  // parseSaksgangEventDate handles the formats the timeline dates use.
  const parsed = parseSaksgangEventDate('23.04.2025 00:00:00');
  assert.equal(parsed?.getUTCFullYear(), 2025);
  assert.equal(parsed?.getUTCMonth(), 3);
  assert.equal(parsed?.getUTCDate(), 23);
  assert.equal(parseSaksgangEventDate('01.01.0001 00:00:00'), null);
  assert.equal(parseSaksgangEventDate(undefined), null);

  // hearingsFromSaksgang surfaces hearings the timeline shows but the horinger
  // export misses (finished sak with only saksgang evidence).
  const hearingSak = {
    id: 103102,
    korttittel: 'Endringer i lov om pensjonstrygd for fiskere',
    komite: { navn: 'Næringskomiteen' },
    saksgang: {
      saksgang_steg_liste: [
        {
          navn: 'Komitebehandling',
          saksgang_hendelse_liste: [
            { id: 'SENDT', dato: '23.10.2025 00:00:00' },
            { id: 'HOER', dato: '23.04.2025 00:00:00' },
            { id: 'AVGITT', dato: '25.11.2025 00:00:00' },
          ],
        },
      ],
    },
  } as StortingetSakDetail;
  const saksgangHearing = hearingsFromSaksgang(hearingSak);
  assert.equal(saksgangHearing.length, 1, 'only the HOER event is a hearing');
  assert.equal(saksgangHearing[0].startDate, '2025-04-23T00:00:00.000Z');
  assert.equal(saksgangHearing[0].statusKind, 'held');
  assert.equal(saksgangHearing[0].statusLabel, 'Avholdt');
  assert.equal(saksgangHearing[0].committee, 'Næringskomiteen');
  assert.equal(saksgangHearing[0].skriftligInnspillUrl, null);
  assert.ok(saksgangHearing[0].id.startsWith('saksgang-103102-'));

  // HOERFRIST without a HOER becomes an open/held entry with a real deadline.
  const fristSak = {
    id: 999,
    korttittel: 'Frist-sak',
    saksgang: {
      saksgang_steg_liste: [
        { navn: 'Komitebehandling', saksgang_hendelse_liste: [{ id: 'HOERFRIST', dato: '15.12.2099' }] },
      ],
    },
  } as StortingetSakDetail;
  const fristHearing = hearingsFromSaksgang(fristSak);
  assert.equal(fristHearing.length, 1);
  assert.equal(fristHearing[0].statusKind, 'open');
  assert.equal(fristHearing[0].statusLabel, 'Åpen for innspill');
  assert.ok(fristHearing[0].deadline?.startsWith('2099-12-15'));

  // Non-hearing events (VOT, AVGITT …) never become hearings.
  const noHearingSak = {
    id: 7,
    korttittel: 'Uten høring',
    saksgang: {
      saksgang_steg_liste: [
        { navn: 'Votering', saksgang_hendelse_liste: [{ id: 'VOT', dato: '15.05.2099' }] },
      ],
    },
  } as StortingetSakDetail;
  assert.deepEqual(hearingsFromSaksgang(noHearingSak), []);

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
