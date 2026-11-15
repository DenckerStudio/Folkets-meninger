import assert from 'node:assert/strict';
import { buildSakStortingetOversiktExtras } from '@/lib/sak/stortinget-public-status';

const detail = {
  komite: { navn: 'Arbeids- og sosialkomiteen' },
  ferdigbehandlet: true,
  saksgang: {
    saksgang_steg_liste: [
      {
        navn: 'Stortinget',
        saksgang_hendelse_liste: [
          { id: 'VEDTAK', hendelse_tekst: 'Vedtatt', dato: '20.06.2025' },
        ],
      },
    ],
  },
} as import('@/lib/stortinget').StortingetSakDetail;

const extras = buildSakStortingetOversiktExtras({
  sakId: '103102',
  detail,
  treatmentStatus: 'closed',
  documents: [],
});

assert.ok(extras);
assert.ok(extras?.decisionDateLabel);
assert.match(extras?.stortingetSakUrl ?? '', /stortinget\.no/);

console.log('lib/sak/stortinget-public-status.test.ts: ok');