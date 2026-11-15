import assert from 'node:assert/strict';
import { buildHenvisningToSakIdIndex, extractHenvisninger, resolveSporsmalSakId } from './sak-link';

const text =
  'Jeg viser til Innst. 37 L (2025-2026) om pensjonstrygden og Prop. 133 L (2024-2025).';
const refs = extractHenvisninger(text);
assert.ok(refs.some((r) => r.includes('innst. 37 l')));
assert.ok(refs.some((r) => r.includes('prop. 133 l')));

const index = buildHenvisningToSakIdIndex([
  { id: '103102', henvisning: 'Prop. 133 L (2024-2025), Innst. 37 L (2025-2026)' },
]);

assert.equal(
  resolveSporsmalSakId('Representantforslag om endringer', index),
  null,
);
assert.equal(resolveSporsmalSakId(text, index), '103102');

console.log('lib/sporsmal/sak-link.test.ts: ok');