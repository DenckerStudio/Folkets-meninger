import assert from 'node:assert/strict';
import {
  buildSakDisplaySummary,
  buildSakDisplayTitle,
  classifySakKind,
  isDebattSak,
  mapSakPresentation,
} from './stortinget-sak-presentation';

const lovforslag = {
  dokumentgruppe: 1,
  henvisning: 'Prop. 103 L (2025–2026)',
  korttittel: 'Endringer i verdipapirfondloven (adgang til å inngå inntektsdelingsavtaler)',
  tittel: 'Endringer i verdipapirfondloven (adgang til å inngå inntektsdelingsavtaler)',
};

const representantforslag = {
  dokumentgruppe: 4,
  henvisning: 'Dokument 8:302 S (2025–2026)',
  korttittel: 'Representantforslag om forenkling og avbyråkratisering i jernbanesektoren',
  tittel:
    'Representantforslag fra stortingsrepresentantene Geir Inge Lien og Bengt Fasteraune om forenkling og avbyråkratisering i jernbanesektoren',
};

const riksrevisjon = {
  dokumentgruppe: 6,
  henvisning: 'Dokument 3:17 (2025–2026)',
  korttittel: 'Riksrevisjonen si undersøking av Kunnskapsdepartementet',
  tittel: 'Riksrevisjonen si undersøking av Kunnskapsdepartementet',
};

const propUtenL = {
  dokumentgruppe: 1,
  henvisning: 'Prop. 92 S (2025-2026), Innst. 442 S (2025-2026)',
  korttittel: 'Statsbudsjettet',
  tittel: 'Statsbudsjettet',
};

assert.equal(classifySakKind(lovforslag), 'lovforslag');
assert.equal(classifySakKind(representantforslag), 'representantforslag');
assert.equal(classifySakKind(riksrevisjon), null);
assert.equal(classifySakKind(propUtenL), null);

assert.equal(isDebattSak(lovforslag), true);
assert.equal(isDebattSak(riksrevisjon), false);

const repTitle = buildSakDisplayTitle(representantforslag);
assert.equal(repTitle, representantforslag.korttittel);
assert.equal(buildSakDisplaySummary(representantforslag, repTitle), representantforslag.tittel);

const lovTitle = buildSakDisplayTitle(lovforslag);
assert.equal(lovTitle, lovforslag.korttittel);
assert.equal(buildSakDisplaySummary(lovforslag, lovTitle), '');

const wheelchair = {
  dokumentgruppe: 4,
  henvisning: 'Dokument 8:288 S (2025–2026)',
  korttittel:
    'Representantforslag fra stortingsrepresentantene Remi Sølvberg, Sofie Marhaug og Geir Jørgensen om å sikre rullestolbrukere likeverdig tilgang til luftfart',
  tittel:
    'Representantforslag fra stortingsrepresentantene Remi Sølvberg, Sofie Marhaug og Geir Jørgensen om å sikre rullestolbrukere likeverdig tilgang til luftfart',
};
assert.equal(buildSakDisplayTitle(wheelchair), wheelchair.korttittel);
assert.equal(buildSakDisplaySummary(wheelchair, wheelchair.korttittel), '');

const mapped = mapSakPresentation({ ...representantforslag, emneNavn: null });
assert.equal(mapped.kind, 'representantforslag');
assert.equal(mapped.category, 'Representantforslag');

console.log('stortinget sak presentation tests passed');
