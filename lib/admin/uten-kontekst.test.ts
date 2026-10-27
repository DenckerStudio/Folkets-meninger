import assert from 'node:assert/strict';
import {
  getUtenKontekstPrefixNoticeMessage,
  getUnclosedUtenKontekstPrefixPublishError,
  isPollDraftUtenKontekst,
  pollHasUtenKontekstMarkerInPublicText,
  preparePollPublicTextForPublish,
  stripUtenKontekstMarkerFromText,
  textHasUtenKontekstMarkerPrefix,
  UTEN_KONTEKST_MARKER_PREFIX,
} from '@/lib/admin/uten-kontekst';

assert.equal(UTEN_KONTEKST_MARKER_PREFIX, '[UTEN KONTEKST');

assert.equal(isPollDraftUtenKontekst({}), false);
assert.equal(isPollDraftUtenKontekst({ uten_kontekst: true }), true);

const marker =
  '[UTEN KONTEKST: ingen RAG-treff, sjekk før godkjenning] Dette er et sammendrag.';
const body = 'Dette er et sammendrag.';

assert.equal(textHasUtenKontekstMarkerPrefix(marker), true);
assert.equal(textHasUtenKontekstMarkerPrefix(`  \n${marker}`), true);
assert.equal(textHasUtenKontekstMarkerPrefix('Vanlig tekst'), false);

const strippedSummary = stripUtenKontekstMarkerFromText(marker);
assert.equal(strippedSummary.kind, 'stripped');
if (strippedSummary.kind === 'stripped') {
  assert.equal(strippedSummary.text, body);
}

const titleMarker = `${UTEN_KONTEKST_MARKER_PREFIX}: tittel] Spørsmål?`;
const strippedTitle = stripUtenKontekstMarkerFromText(titleMarker);
assert.equal(strippedTitle.kind, 'stripped');
if (strippedTitle.kind === 'stripped') {
  assert.equal(strippedTitle.text, 'Spørsmål?');
}

const bothTitle = `${UTEN_KONTEKST_MARKER_PREFIX}: x] T`;
const bothSummary = `${UTEN_KONTEKST_MARKER_PREFIX}: y] S`;
const preparedBoth = preparePollPublicTextForPublish({
  title: bothTitle,
  neutralSummary: bothSummary,
});
assert.equal('error' in preparedBoth, false);
if (!('error' in preparedBoth)) {
  assert.equal(preparedBoth.textChanged, true);
  assert.equal(preparedBoth.title, 'T');
  assert.equal(preparedBoth.neutralSummary, 'S');
}

const noPrefix = preparePollPublicTextForPublish({
  title: 'Spørsmål?',
  neutralSummary: 'OK',
});
assert.equal('error' in noPrefix, false);
if (!('error' in noPrefix)) {
  assert.equal(noPrefix.textChanged, false);
}

const unclosed = `${UTEN_KONTEKST_MARKER_PREFIX} uten bracket`;
assert.equal(stripUtenKontekstMarkerFromText(unclosed).kind, 'unclosed_prefix');
const blocked = preparePollPublicTextForPublish({
  title: unclosed,
  neutralSummary: 'OK',
});
assert.equal('error' in blocked, true);

assert.equal(
  getUtenKontekstPrefixNoticeMessage({ title: 'OK', neutralSummary: marker }),
  'Sammendraget har merknaden «[UTEN KONTEKST …]». Den fjernes når du publiserer – sjekk fakta først.',
);
assert.equal(
  getUtenKontekstPrefixNoticeMessage({ title: titleMarker, neutralSummary: 'OK' }),
  'Tittelen har merknaden «[UTEN KONTEKST …]». Den fjernes når du publiserer – sjekk fakta først.',
);
assert.equal(
  getUtenKontekstPrefixNoticeMessage({ title: titleMarker, neutralSummary: marker })?.startsWith(
    'Tittelen og sammendraget',
  ),
  true,
);

assert.equal(
  getUnclosedUtenKontekstPrefixPublishError({ title: unclosed, neutralSummary: 'OK' })?.endsWith(
    '.',
  ),
  true,
);

assert.equal(
  pollHasUtenKontekstMarkerInPublicText({ title: 'OK', neutralSummary: marker }),
  true,
);

console.log('uten-kontekst.test.ts: ok');
