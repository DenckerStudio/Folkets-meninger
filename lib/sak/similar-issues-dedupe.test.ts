import assert from 'node:assert/strict';
import { dedupeSimilarSaker } from '@/lib/sak/similar-issues-dedupe';
import { shouldShowSimilarSakerSection } from '@/lib/sak/similar-issues';

const base = [
  { id: '100', title: 'A', sesjon: null, status: 'pending' as const, statusLabel: 'Under behandling' },
  { id: '200', title: 'B', sesjon: null, status: 'pending' as const, statusLabel: 'Under behandling' },
  { id: '300', title: 'C', sesjon: null, status: 'closed' as const, statusLabel: 'Ferdigbehandlet' },
];

assert.deepEqual(dedupeSimilarSaker(base, '100', ['200']), [{ ...base[2] }]);
assert.deepEqual(dedupeSimilarSaker(base, '999', []), base);
assert.equal(shouldShowSimilarSakerSection(dedupeSimilarSaker(base, '100', ['200', '300'])), false);

console.log('lib/sak/similar-issues-dedupe.test.ts: ok');