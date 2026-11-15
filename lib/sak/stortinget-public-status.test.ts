import assert from 'node:assert/strict';
import {
  buildSakStortingetPublicStatus,
  extractViktigeSaksgangHendelser,
} from '@/lib/sak/stortinget-public-status';

const detail = {
  komite: { navn: 'Arbeids- og sosialkomiteen' },
  ferdigbehandlet: true,
  saksgang: {
    saksgang_steg_liste: [
      {
        navn: 'Stortinget',
        saksgang_hendelse_liste: [
          { id: 'SENDT', hendelse_tekst: null, dato: '15.03.2025' },
          { id: 'VEDTAK', hendelse_tekst: 'Vedtatt', dato: '20.06.2025' },
          { id: 'NOISE', hendelse_tekst: 'Uten dato', dato: null },
        ],
      },
    ],
  },
} as import('@/lib/stortinget').StortingetSakDetail;

const events = extractViktigeSaksgangHendelser(detail);
assert.equal(events.length, 2);
assert.equal(events[1]?.id, 'VEDTAK');

const status = buildSakStortingetPublicStatus({
  sakId: '103102',
  detail,
  treatmentStatus: 'closed',
  documents: [
    {
      id: 'doc-1',
      title: 'Innstilling',
      kind: 'innstilling',
      exportId: 'inns',
      sourceUrl: null,
      viewable: true,
      documentType: 'inns',
    },
  ],
});

assert.ok(status);
assert.equal(status?.committee, 'Arbeids- og sosialkomiteen');
assert.equal(status?.documentLinks.length, 1);
assert.match(status?.documentLinks[0]?.href ?? '', /#dokumenter/);

console.log('lib/sak/stortinget-public-status.test.ts: ok');