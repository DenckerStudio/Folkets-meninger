import assert from 'node:assert/strict';
import { exportIdFromPublicationUrl } from './stortinget-publication-url';

assert.equal(
  exportIdFromPublicationUrl(
    '//www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Representantforslag/2025-2026/dok8-202526-001s/',
  ),
  'dok8-202526-001s',
);

assert.equal(
  exportIdFromPublicationUrl('https://data.stortinget.no/eksport/publikasjon?publikasjonid=inns-202526-448s'),
  'inns-202526-448s',
);

console.log('stortinget-publication-url.test.ts ok');
