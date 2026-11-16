import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PRIVACY_COMPLAINT } from './privacy-notice-content';

assert.match(PRIVACY_COMPLAINT, /klage til Datatilsynet/i);
assert.ok(!PRIVACY_COMPLAINT.includes('www.'), 'Klagenotat skal ikke lenke til nettsted som CTA');

const personvernPage = readFileSync(
  path.join(process.cwd(), 'app/personvern/page.tsx'),
  'utf8',
);
assert.ok(
  !personvernPage.includes('Klage til Datatilsynet'),
  'Personvern-siden skal ikke ha egen overskrift om klage',
);
assert.equal(
  (personvernPage.match(/PRIVACY_COMPLAINT/g) ?? []).length,
  2,
  'Klagenotat skal importeres og vises én gang',
);

console.log('privacy-notice-content.test.ts: ok');