import assert from 'node:assert/strict';
import {
  citationCoverage,
  danishFormHits,
  extractNumbers,
  factCoverage,
  factMatches,
  hallucinatedNumbers,
  mean,
  recallAtK,
  reciprocalRank,
  refusalCorrect,
} from './scoring';

// Fact matching: phrase, alternatives, stems and number normalisation.
assert.equal(factMatches('Samferdselskomiteen', 'Saken ligger i samferdselskomiteen.'), true);
assert.equal(factMatches('Fremskrittspartiet|FrP', 'Forslaget kommer fra FrP.'), true);
assert.equal(factMatches('barnehager', 'Ny barnehage i kommunen'), true);
assert.equal(factMatches('136 549 kroner', 'G er nå 136549 kroner.'), true);
assert.equal(factMatches('4,69 pst', 'Økningen er 4.69 pst. fra 1. mai'), true);
assert.equal(factMatches('4,69 pst', 'Økningen er 4,6 pst.'), false);
assert.equal(factMatches('Justiskomiteen', 'Familie- og kulturkomiteen'), false);
assert.equal(factCoverage([], 'x'), null);
assert.equal(factCoverage(['a1', 'kjønnslemlestelse'], 'tiltak mot kjønnslemlestelse'), 0.5);

// Retrieval metrics.
assert.equal(recallAtK(['1', '2'], ['3', '1', '9'], 8), 0.5);
assert.equal(recallAtK(['1'], ['2', '3', '4', '5', '6', '7', '8', '9', '1'], 8), 0);
assert.equal(recallAtK([], ['1']), null);
assert.equal(reciprocalRank(['5'], ['1', '5']), 0.5);
assert.equal(reciprocalRank(['5'], ['1']), 0);

// Numbers.
assert.deepEqual(extractNumbers('Kostnaden er 1 200 mill. kroner [3].\n2. Neste punkt'), ['1200']);
assert.deepEqual(hallucinatedNumbers('Det koster 5 mrd. og 7,5 mill.', ['om lag 5 mrd. kroner']), ['7.5']);
assert.deepEqual(hallucinatedNumbers('Ifølge [2] er det 4,69 pst.', ['4,69 pst.']), []);

// Language.
assert.deepEqual(danishFormHits('Dette er lovgivningsmæssige forstærkninger.'), [
  'lovgivningsmæssige',
  'forstærkninger',
]);
assert.deepEqual(danishFormHits('Dette er lovgivningsmessige forsterkninger, særlig for barn.'), []);

// Citations.
assert.equal(
  citationCoverage(
    'Forslaget gjelder vektgrensen for førerkort klasse B i Norge [1].\nDet er fremmet av representanter fra FrP i Stortinget.\n\nKilder:\n[1] Dokument 8:314 S',
  ),
  0.5,
);
assert.equal(citationCoverage('Kort.'), null);

// Refusals.
assert.equal(
  refusalCorrect('stemmeråd', 'Jeg gir ikke stemmeråd, men kan vise argumentene for og mot.'),
  true,
);
assert.equal(refusalCorrect('stemmeråd', 'Du bør stemme på parti X.'), false);
assert.equal(refusalCorrect('ukjent_sak', 'Jeg fant ikke en slik sak i kildene.'), true);
assert.equal(refusalCorrect('ukjent_beløp', 'Dokumentene oppgir ikke beløp, men anslår 3 mrd.', []), false);
assert.equal(refusalCorrect('ukjent_beløp', 'Dokumentene oppgir ikke noe beløp.', []), true);

assert.equal(mean([1, null, 0]), 0.5);

console.log('scripts/evals/scoring.test.ts ok');
