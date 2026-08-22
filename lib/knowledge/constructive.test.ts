import assert from 'node:assert/strict';
import { isConstructiveArgument } from './constructive';

assert.equal(isConstructiveArgument('ja'), false);
assert.equal(isConstructiveArgument('Dette er et kort nei.'), false);
assert.equal(
  isConstructiveArgument(
    'Jeg støtter en målrettet kompensasjon for pendlere, fordi dagens innretning rammer distriktene hardere enn byene uten at det er begrunnet i saksdokumentene.',
  ),
  true,
);

console.log('constructive argument tests passed');
