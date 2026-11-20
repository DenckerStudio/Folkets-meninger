import assert from 'node:assert/strict';
import {
  cleanForslagForDisplay,
  isForslageneTopicCard,
  parseForslagItemsFromCardBody,
  parseForslagJsonb,
  resolveForslagForSummary,
} from './forslag';

const ten = Array.from({ length: 10 }, (_, i) => `Forslag ${i + 1} til regjeringen.`);

assert.equal(parseForslagJsonb(ten)?.length, 10);
assert.deepEqual(parseForslagJsonb([]), []);
assert.equal(parseForslagJsonb(null), null);

const cardBody = ten.map((t, i) => `${i + 1}) ${t}`).join('; ') + '.';
const parsed = parseForslagItemsFromCardBody(cardBody);
assert.equal(parsed.length, 10);
assert.equal(parsed[0], ten[0]);

assert.ok(isForslageneTopicCard('Forslagene (10)'));

const fromColumn = resolveForslagForSummary(ten, [
  { title: 'Forslagene (10)', body: cardBody },
  { title: 'Annet', body: 'tekst' },
]);
assert.equal(fromColumn.forslag.length, 10);
assert.equal(fromColumn.topic_cards.length, 1);
assert.equal(fromColumn.topic_cards[0]?.title, 'Annet');

const emptyColumn = resolveForslagForSummary([], [
  { title: 'Forslagene (10)', body: cardBody },
]);
assert.deepEqual(emptyColumn.forslag, []);
assert.equal(emptyColumn.topic_cards.length, 0);

const legacy = resolveForslagForSummary(null, [{ title: 'Forslagene (2)', body: '1) A; 2) B.' }]);
assert.deepEqual(legacy.forslag, ['A', 'B']);

// Lagrede forslag for sak 200211 slik de vises på folkets-meninger.no: innledningen kommer først
// og inneholder hele forslag 1 som prefiks, og begge starter med en setningsrest.
const stored200211 = [
  ', så snart som mulig, fremme forslag om å innføre en klimabelønningsordning der statens inntekter fra CO 2 -avgiften på bensin og autodiesel utbetales til alle innbyggere, inkludert barn, med høyere beløp for personer bosatt i områder som i dag har redusert arbeidsgiveravgift. Utbetalingene kan administreres gjennom eksisterende systemer, for eksempel via Skatteetaten. Forslag På denne bakgrunn fremmes følgende forslag:',
  ', så snart som mulig, fremme forslag om å innføre en klimabelønningsordning der statens inntekter fra CO 2 -avgiften på bensin og autodiesel utbetales til alle innbyggere, inkludert barn, med høyere beløp for personer bosatt i områder som i dag har redusert arbeidsgiveravgift.',
  'Utrede hvordan klimabelønningsordningen kan utvides til å omfatte andre CO 2 -avgifter enn CO 2 -avgiftene på bensin og autodiesel, og komme tilbake til Stortinget på egnet måte. For CO 2 -avgifter som i hovedsak kreves inn fra næringslivet, kan klimabelønningsordningen innrettes mot bedrifter i form av omstillingsfond.',
];
const cleaned200211 = cleanForslagForDisplay(stored200211);
assert.equal(cleaned200211.length, 2, 'innledningen og dobbeltføringen av forslag 1 er borte');
assert.ok(cleaned200211[0].startsWith('Så snart som mulig, fremme forslag om å innføre'));
assert.ok(!cleaned200211[0].includes('På denne bakgrunn'));
assert.ok(cleaned200211[1].startsWith('Utrede hvordan klimabelønningsordningen'));

assert.deepEqual(cleanForslagForDisplay(['A forslag om x.', 'a  forslag om x.']), ['A forslag om x.'], 'like forslag vises én gang');
assert.deepEqual(
  cleanForslagForDisplay(['Utrede kostnadene ved ordningen grundig', 'Utrede kostnadene ved ordningen grundig og komme tilbake til Stortinget']),
  ['Utrede kostnadene ved ordningen grundig og komme tilbake til Stortinget'],
  'avkortet kopi av et lengre forslag droppes',
);
assert.deepEqual(cleanForslagForDisplay(['Ja', 'Ja, mer enn bare det']), ['Ja', 'Ja, mer enn bare det'], 'korte forslag slås ikke sammen');
assert.deepEqual(cleanForslagForDisplay(['', '   ', 'Følgende forslag fremmes:']), []);
assert.deepEqual(cleanForslagForDisplay([]), []);

console.log('ai-summary forslag tests passed');
