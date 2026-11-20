import assert from 'node:assert/strict';
import {
  buildSimilarSakReasons,
  komiteNameFromDetail,
  parseSimilarSakFacets,
  type SimilarSakFacets,
} from './similar-issues-labels';

const current: SimilarSakFacets = {
  komite: 'Finanskomiteen',
  emner: ['Forurensning', 'Skatter og avgifter'],
  sakKind: 'representantforslag',
};

assert.deepEqual(
  buildSimilarSakReasons(current, {
    komite: 'finanskomiteen',
    emner: ['Skatter og avgifter', 'Transport'],
    sakKind: 'representantforslag',
  }),
  ['Samme emne: Skatter og avgifter', 'Samme komité: finanskomiteen', 'Samme sakstype: representantforslag'],
);

assert.deepEqual(
  buildSimilarSakReasons(current, {
    komite: 'Transport- og kommunikasjonskomiteen',
    emner: ['Forurensning', 'Skatter og avgifter', 'Klima'],
    sakKind: 'lovforslag',
  }),
  ['Samme emner: Forurensning, Skatter og avgifter'],
  'bare felles fakta, flere emner samles',
);

assert.deepEqual(
  buildSimilarSakReasons(current, { komite: null, emner: [], sakKind: null }),
  [],
  'ingen felles fakta gir ingen grunn',
);
assert.deepEqual(buildSimilarSakReasons(null, current), []);
assert.deepEqual(buildSimilarSakReasons(current, undefined), []);
assert.deepEqual(
  buildSimilarSakReasons({ komite: null, emner: [], sakKind: null }, { komite: null, emner: [], sakKind: null }),
  [],
  'manglende data på begge sider er ikke «samme»',
);

assert.deepEqual(
  parseSimilarSakFacets({
    komite_navn: ' Finanskomiteen ',
    emner: [{ navn: 'Forurensning' }, { navn: 'forurensning' }, 'Klima', null, {}],
    sak_kind: 'representantforslag',
  }),
  { komite: 'Finanskomiteen', emner: ['Forurensning', 'Klima'], sakKind: 'representantforslag' },
);
assert.deepEqual(parseSimilarSakFacets({ komite_raw: 'Justiskomiteen', sak_kind: 'annet' }), {
  komite: 'Justiskomiteen',
  emner: [],
  sakKind: null,
});
assert.equal(parseSimilarSakFacets({ komite_raw: '{"navn":"x"}' }).komite, null, 'rå JSON-objekt brukes ikke som navn');
assert.deepEqual(parseSimilarSakFacets({}), { komite: null, emner: [], sakKind: null });

assert.equal(komiteNameFromDetail({ navn: 'Finanskomiteen' }), 'Finanskomiteen');
assert.equal(komiteNameFromDetail('Justiskomiteen'), 'Justiskomiteen');
assert.equal(komiteNameFromDetail(undefined), null);

console.log('lib/sak/similar-issues-labels.test.ts: ok');
