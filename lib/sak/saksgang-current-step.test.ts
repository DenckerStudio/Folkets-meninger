import assert from 'node:assert/strict';
import { resolveCurrentSaksgangStepIndex, resolveCurrentSaksgangStepName } from './saksgang-current-step';

const referred = { id: 'REFS', label: 'Referert i Stortinget', date: '9. apr. 2026' };
const sent = { id: 'SENDT', label: 'Sendt til komité', date: '9. apr. 2026' };
const innstilling = { id: 'AVGITT', label: 'Innstilling avgitt', date: '12. juni 2026' };
const behandlet = { id: 'BEHS', label: 'Behandlet i Stortinget', date: '19. juni 2026' };

const closedSteps = [
  { navn: 'Forslag', events: [referred] },
  { navn: 'Komitebehandling', events: [sent, innstilling] },
  { navn: 'Debatt og vedtak', events: [behandlet] },
];

assert.equal(
  resolveCurrentSaksgangStepIndex(closedSteps, true),
  -1,
  'ferdigbehandlet sak skal ikke ha et «Nå»-steg',
);
assert.equal(resolveCurrentSaksgangStepName(closedSteps, true), null);

assert.equal(
  resolveCurrentSaksgangStepIndex(
    [
      { navn: 'Forslag', events: [referred] },
      { navn: 'Komitebehandling', events: [sent] },
      { navn: 'Debatt og vedtak', events: [] },
    ],
    false,
  ),
  1,
  'komité har fått saken men ikke levert innstilling: komité pågår',
);

assert.equal(
  resolveCurrentSaksgangStepIndex(
    [
      { navn: 'Forslag', events: [referred] },
      { navn: 'Komitebehandling', events: [sent, innstilling] },
      { navn: 'Debatt og vedtak', events: [] },
    ],
    false,
  ),
  2,
  'innstilling avgitt: debatt og vedtak er neste steg',
);

assert.equal(
  resolveCurrentSaksgangStepName(
    [
      { navn: 'A', events: [{ label: 'x', date: '1' }] },
      { navn: 'B', events: [] },
    ],
    false,
  ),
  'A',
  'ukjent hendelse uten avslutningsmarkør holder steget som pågår',
);

assert.equal(resolveCurrentSaksgangStepIndex([{ navn: 'A', events: [] }], false), 0);
assert.equal(resolveCurrentSaksgangStepIndex([], false), 0);

console.log('saksgang-current-step.test.ts OK');
