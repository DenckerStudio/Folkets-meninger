import assert from 'node:assert/strict';
import {
  getPublishBlockedUtenKontekstMessage,
  isPollDraftUtenKontekst,
  pollHasUtenKontekstMarkerInPublicText,
  textHasUtenKontekstMarkerPrefix,
  UTEN_KONTEKST_MARKER_PREFIX,
  UTEN_KONTEKST_PUBLISH_BLOCKED_MESSAGE,
} from '@/lib/admin/uten-kontekst';

assert.equal(UTEN_KONTEKST_MARKER_PREFIX, '[UTEN KONTEKST');

assert.equal(isPollDraftUtenKontekst({}), false);
assert.equal(isPollDraftUtenKontekst({ uten_kontekst: false }), false);
assert.equal(isPollDraftUtenKontekst({ uten_kontekst: true }), true);
assert.equal(isPollDraftUtenKontekst(null), false);

const marker =
  '[UTEN KONTEKST: ingen RAG-treff, sjekk før godkjenning] Dette er et sammendrag.';
assert.equal(textHasUtenKontekstMarkerPrefix(marker), true);
assert.equal(textHasUtenKontekstMarkerPrefix(`  \n${marker}`), true);
assert.equal(textHasUtenKontekstMarkerPrefix('Vanlig tekst'), false);
assert.equal(textHasUtenKontekstMarkerPrefix('[uten kontekst]'), false);

assert.equal(
  pollHasUtenKontekstMarkerInPublicText({
    title: 'Spørsmål?',
    neutralSummary: marker,
  }),
  true,
);
assert.equal(
  pollHasUtenKontekstMarkerInPublicText({
    title: ` ${UTEN_KONTEKST_MARKER_PREFIX}: …] Tittel`,
    neutralSummary: 'OK',
  }),
  true,
);
assert.equal(
  pollHasUtenKontekstMarkerInPublicText({
    title: 'Spørsmål?',
    neutralSummary: 'OK',
  }),
  false,
);

assert.equal(
  getPublishBlockedUtenKontekstMessage({
    title: 'Spørsmål?',
    neutralSummary: marker,
  }),
  UTEN_KONTEKST_PUBLISH_BLOCKED_MESSAGE,
);
assert.equal(
  getPublishBlockedUtenKontekstMessage({
    title: 'Spørsmål?',
    neutralSummary: 'Ferdig redigert',
  }),
  null,
);

console.log('uten-kontekst.test.ts: ok');
