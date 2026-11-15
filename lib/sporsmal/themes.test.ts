import assert from 'node:assert/strict';
import type { StortingetSporsmal } from '@/lib/stortinget-sporsmal';
import { resolveSporsmalTheme } from './themes';

const base: StortingetSporsmal = {
  id: 1,
  tittel: 'Generelt spørsmål uten tydelig tema',
};

assert.equal(resolveSporsmalTheme(base), 'Annet');

assert.equal(
  resolveSporsmalTheme({
    ...base,
    sporsmal_til_minister_tittel: 'klima- og miljøministeren',
  }),
  'Klima og miljø',
);

assert.equal(
  resolveSporsmalTheme({
    ...base,
    tittel: 'Hva gjør regjeringen for å styrke fastlegeordningen og sykehuskapasitet?',
  }),
  'Helse og omsorg',
);

assert.equal(
  resolveSporsmalTheme({
    ...base,
    emne_liste: [{ navn: 'Fiskerier', er_hovedemne: true }],
  }),
  'Landbruk og mat',
);

assert.equal(
  resolveSporsmalTheme({
    ...base,
    theme: 'Energi',
  }),
  'Energi',
);

console.log('lib/sporsmal/themes.test.ts: ok');