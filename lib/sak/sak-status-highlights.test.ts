import assert from 'node:assert/strict';
import type { StortingetSakDetail } from '@/lib/stortinget';
import { buildSakStatusHighlight } from './sak-status-highlights';

const NO_DATE = '01.01.0001 00:00:00';

// Utdrag av Stortingets eksport for sak 200211 (representantforslag, ikke vedtatt).
const sak200211 = {
  ferdigbehandlet: true,
  saksgang: {
    saksgang_steg_liste: [
      {
        navn: 'Komitebehandling',
        saksgang_hendelse_liste: [{ id: 'AVGITT', dato: '12.06.2026 00:00:00' }],
      },
      {
        navn: 'Debatt og vedtak',
        saksgang_hendelse_liste: [
          { id: 'BEHS', dato: '19.06.2026 00:00:00' },
          { id: 'VOT', dato: '19.06.2026 00:00:00' },
          { id: 'VEDTAK', dato: NO_DATE },
        ],
      },
    ],
  },
} as unknown as StortingetSakDetail;

const kortvedtak =
  'Stortinget har behandlet et representantforslag fra Miljøpartiet De Grønne om å dele ut statens inntekter fra klimaavgifter til befolkningen.\r\n\r\nForslaget ble ikke vedtatt. \r\n\r\n';

const closed = buildSakStatusHighlight({
  sakId: '200211',
  detail: sak200211,
  treatmentStatus: 'closed',
  linkedHearings: [],
  kortvedtak,
  vedtakstekst: 'Vedtak i samsvar med innstillingen',
});
assert.equal(closed.statusLabel, 'Ferdigbehandlet');
assert.equal(closed.outcomeKind, 'rejected');
assert.equal(closed.outcomeLabel, 'Ikke vedtatt');
assert.equal(closed.vedtakExcerpt, 'Forslaget ble ikke vedtatt.', 'kun utfallssetningen, ikke hele kortvedtaket');
assert.equal(closed.decisionDateLabel, '19. juni 2026', 'behandlingsdagen fra saksgangen, ikke dagen etter');
assert.equal(closed.nextStepLabel, null);

const closedWithoutOutcomeSentence = buildSakStatusHighlight({
  sakId: '1',
  detail: null,
  treatmentStatus: 'closed',
  linkedHearings: [],
  kortvedtak: 'Stortinget har behandlet saken og sendt den videre.',
});
assert.equal(closedWithoutOutcomeSentence.outcomeKind, 'unknown');
assert.equal(closedWithoutOutcomeSentence.outcomeLabel, null);
assert.equal(
  closedWithoutOutcomeSentence.vedtakExcerpt,
  'Stortinget har behandlet saken og sendt den videre.',
  'uten kjent utfall vises Stortingets tekst som før',
);
assert.equal(closedWithoutOutcomeSentence.decisionDateLabel, null);

const future = new Date(Date.now() + 40 * 86_400_000);
const futureDotted = `${String(future.getUTCDate()).padStart(2, '0')}.${String(future.getUTCMonth() + 1).padStart(2, '0')}.${future.getUTCFullYear()} 00:00:00`;
const pending = buildSakStatusHighlight({
  sakId: '2',
  detail: {
    ferdigbehandlet: false,
    saksgang: {
      saksgang_steg_liste: [
        { navn: 'Behandling', saksgang_hendelse_liste: [{ id: 'PLBEHS', dato: futureDotted }] },
      ],
    },
  } as unknown as StortingetSakDetail,
  treatmentStatus: 'pending',
  linkedHearings: [],
  kortvedtak,
});
assert.equal(pending.statusLabel, 'Under behandling');
assert.equal(pending.outcomeKind, 'pending');
assert.equal(pending.vedtakExcerpt, null, 'ingen vedtak på en sak under behandling');
assert.equal(pending.decisionDateLabel, null);
assert.equal(pending.nextStepLabel, 'Planlagt behandling');
assert.match(pending.nextStepDateLabel ?? '', /^\d{1,2}\. [a-zæøå]+ \d{4}$/, 'langt månedsnavn, ett datoformat');

const pendingNoPlan = buildSakStatusHighlight({
  sakId: '3',
  detail: null,
  treatmentStatus: 'pending',
  linkedHearings: [],
});
assert.equal(pendingNoPlan.nextStepLabel, null);
assert.equal(pendingNoPlan.nextStepDateLabel, null);

console.log('lib/sak/sak-status-highlights.test.ts: ok');
