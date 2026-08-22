import assert from 'node:assert/strict';
import {
  classifySakKind,
  getSakEventTooltip,
  getSakKindLabel,
  getSakStepTooltip,
  SAK_META_TOOLTIPS,
} from './stortinget-sak-tooltips';

assert.equal(
  classifySakKind({ dokumentgruppe: 1, henvisning: 'Prop. 103 L (2025–2026)' }),
  'lovforslag',
);
assert.equal(
  classifySakKind({ dokumentgruppe: 4, henvisning: 'Dokument 8:302 S (2025–2026)' }),
  'representantforslag',
);
assert.equal(classifySakKind({ dokumentgruppe: 6, henvisning: 'Dokument 3:17' }), null);

assert.equal(getSakKindLabel('lovforslag'), 'Lovforslag');
assert.ok(getSakEventTooltip('FREMMET')?.includes('offisielt'));
assert.ok(getSakEventTooltip('SENDT')?.includes('komité'));
assert.ok(getSakStepTooltip('I komité')?.includes('Komiteen'));
assert.ok(SAK_META_TOOLTIPS.konsekvensKalkulator.includes('Anonymt'));
assert.ok(SAK_META_TOOLTIPS.samsvarsScore.includes('Stortingets'));

console.log('stortinget sak tooltips tests passed');
