import assert from 'node:assert/strict';
import {
  buildSaksgangSteps,
  formatSaksgangEventDate,
  parseSaksgangEventDate,
  latestPastSaksgangEventDate,
  nextPlannedSaksgangDate,
  saksgangDecisionDate,
  resolveSakLastUpdatedDate,
  saksgangFinishedSummaryLabel,
} from './saksgang-steps';

const NO_DATE = '01.01.0001 00:00:00';

// Utdrag av Stortingets eksport for sak 200211 (representantforslag, ikke vedtatt).
const sak200211 = [
  {
    navn: 'Forslag',
    saksgang_hendelse_liste: [
      { id: 'FRAREP', dato: NO_DATE },
      { id: 'SAK', dato: NO_DATE },
      { id: 'FREMSATT', dato: '26.03.2026 00:00:00' },
      { id: 'REFS', dato: '09.04.2026 00:00:00' },
    ],
  },
  {
    navn: 'Komitebehandling',
    saksgang_hendelse_liste: [
      { id: 'SENDT', dato: '09.04.2026 00:00:00' },
      { id: 'KOMITE', dato: NO_DATE },
      { id: 'AVGITT', dato: '12.06.2026 00:00:00' },
    ],
  },
  {
    navn: 'Debatt og vedtak',
    saksgang_hendelse_liste: [
      { id: 'BEHS', dato: '19.06.2026 00:00:00' },
      { id: 'VOT', dato: '19.06.2026 00:00:00' },
      { id: 'VEDTAK', dato: NO_DATE },
    ],
  },
];

assert.equal(formatSaksgangEventDate('26.03.2026 00:00:00'), '26. mars 2026');
assert.equal(formatSaksgangEventDate('/Date(1781827200000+0200)/'), '19. juni 2026');
assert.equal(formatSaksgangEventDate(NO_DATE), null);
assert.equal(formatSaksgangEventDate(undefined), null);
assert.equal(formatSaksgangEventDate('ikke en dato'), null);
assert.equal(parseSaksgangEventDate('/Date(-62135596800000+0100)/'), null);

const steps = buildSaksgangSteps(sak200211);
assert.deepEqual(
  steps.map((s) => s.events.map((e) => `${e.label}|${e.date}`)),
  [
    ['Forslag fremsatt|26. mars 2026', 'Referert i Stortinget|9. april 2026'],
    ['Sendt til komité|9. april 2026', 'Innstilling avgitt|12. juni 2026'],
    ['Behandlet i Stortinget|19. juni 2026', 'Votering|19. juni 2026'],
  ],
  'hver dato skal ha en etikett, og udaterte ID-hendelser skal skjules',
);

const unknownEvent = buildSaksgangSteps([
  { navn: 'X', saksgang_hendelse_liste: [{ id: 'UKJENT', dato: '01.02.2026 00:00:00' }] },
]);
assert.deepEqual(unknownEvent[0].events, [], 'ukjent hendelse med dato uten tekst vises ikke som bar dato');

const ownText = buildSaksgangSteps([
  { navn: 'X', saksgang_hendelse_liste: [{ id: 'UKJENT', hendelse_tekst: 'Egen tekst', dato: NO_DATE }] },
]);
assert.deepEqual(ownText[0].events, [{ id: 'UKJENT', label: 'Egen tekst', date: null }]);

const now = new Date('2026-11-19T12:00:00Z');
assert.equal(
  resolveSakLastUpdatedDate({
    sakDate: '2026-06-11',
    cachedLastUpdatedAt: '2026-06-11T08:00:00Z',
    saksgangSteg: sak200211,
    now,
  }),
  '2026-06-19',
  'sist oppdatert skal ikke ligge før voteringen',
);

assert.equal(
  resolveSakLastUpdatedDate({
    sakDate: '2026-08-01',
    saksgangSteg: sak200211,
    now,
  }),
  '2026-08-01',
  'senere cache-dato vinner over eldre hendelser',
);

assert.equal(
  resolveSakLastUpdatedDate({
    saksgangSteg: [
      { navn: 'X', saksgang_hendelse_liste: [{ id: 'PLBEHS', dato: '01.12.2026 00:00:00' }] },
      { navn: 'Y', saksgang_hendelse_liste: [{ id: 'SENDT', dato: '01.11.2026 00:00:00' }] },
    ],
    now,
  }),
  '2026-11-01',
  'planlagte (fremtidige) hendelser teller ikke som oppdatering',
);

assert.equal(resolveSakLastUpdatedDate({ saksgangSteg: undefined, now }), null);

assert.equal(
  latestPastSaksgangEventDate(sak200211, now)?.toISOString().split('T')[0],
  '2026-06-19',
  'siste hendelse som har skjedd',
);
assert.equal(latestPastSaksgangEventDate(undefined, now), null);
assert.equal(
  saksgangDecisionDate(sak200211, now)?.toISOString().split('T')[0],
  '2026-06-19',
  'behandlingsdagen er votering/behandling, ikke «innstilling avgitt»',
);
assert.equal(
  saksgangDecisionDate(
    [{ navn: 'X', saksgang_hendelse_liste: [{ id: 'AVGITT', dato: '12.06.2026 00:00:00' }] }],
    now,
  ),
  null,
  'uten behandlingshendelse finnes ingen behandlingsdato',
);
assert.equal(
  latestPastSaksgangEventDate(
    [{ navn: 'X', saksgang_hendelse_liste: [{ id: 'PLBEHS', dato: '01.12.2026 00:00:00' }] }],
    now,
  ),
  null,
  'kun fremtidige hendelser gir ingen dato',
);

const planned = [
  { navn: 'X', saksgang_hendelse_liste: [{ id: 'PLBEHS', dato: '01.12.2026 00:00:00' }] },
  { navn: 'Y', saksgang_hendelse_liste: [{ id: 'PLBEHS', dato: '19.11.2026 00:00:00' }] },
];
assert.equal(
  nextPlannedSaksgangDate(planned, now)?.toISOString(),
  '2026-11-19T12:00:00.000Z',
  'dagen i dag regnes som kommende og tolkes som kalenderdag, ikke 23:59 lokal tid',
);
assert.equal(nextPlannedSaksgangDate(planned, new Date('2026-11-20T09:00:00Z'))?.toISOString(), '2026-12-01T12:00:00.000Z');
assert.equal(nextPlannedSaksgangDate(sak200211, now), null, 'fortidige hendelser er ikke planlagt');
assert.equal(nextPlannedSaksgangDate(undefined, now), null);

assert.equal(saksgangFinishedSummaryLabel('19. juni 2026'), 'Saksgang – ferdigbehandlet 19. juni 2026');
assert.equal(saksgangFinishedSummaryLabel(null), 'Saksgang – ferdigbehandlet');
assert.equal(saksgangFinishedSummaryLabel('  '), 'Saksgang – ferdigbehandlet');

console.log('saksgang-steps.test.ts OK');
