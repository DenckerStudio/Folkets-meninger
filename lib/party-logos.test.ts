import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { routes } from './routes';
import {
  getPartyLogoSrc,
  missingPartyLogos,
  STORTINGET_PARTY_LOGOS,
  uniquePartyNames,
} from './party-logos';

const CURRENT_STORTINGET_PARTIES = [
  'Arbeiderpartiet',
  'Fremskrittspartiet',
  'Høyre',
  'Kristelig Folkeparti',
  'Miljøpartiet De Grønne',
  'Rødt',
  'Senterpartiet',
  'Sosialistisk Venstreparti',
  'Venstre',
] as const;

assert.deepEqual(
  uniquePartyNames(CURRENT_STORTINGET_PARTIES),
  [...CURRENT_STORTINGET_PARTIES].sort((a, b) => a.localeCompare(b, 'no')),
);

assert.deepEqual(missingPartyLogos(CURRENT_STORTINGET_PARTIES), []);
assert.deepEqual(missingPartyLogos([...CURRENT_STORTINGET_PARTIES, 'Ukjent Parti']), [
  'Ukjent Parti',
]);

for (const name of CURRENT_STORTINGET_PARTIES) {
  const src = getPartyLogoSrc(name);
  assert.ok(src, `missing logo mapping for ${name}`);
  assert.equal(src, STORTINGET_PARTY_LOGOS[name]);
  const filePath = path.join(process.cwd(), 'public', src.replace(/^\//, ''));
  assert.ok(existsSync(filePath), `logo file missing for ${name}: ${filePath}`);
}

assert.equal(getPartyLogoSrc('Ukjent Parti'), null);
assert.equal(
  routes.parti('Sosialistisk Venstreparti'),
  '/dashboard/politikere?parti=Sosialistisk%20Venstreparti',
);

console.log('party-logos.test.ts: ok');
