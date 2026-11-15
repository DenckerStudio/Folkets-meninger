import assert from 'node:assert/strict';
import { shouldShowSimilarSakerSection } from '@/lib/sak/similar-issues';

assert.equal(shouldShowSimilarSakerSection([]), false);
assert.equal(shouldShowSimilarSakerSection(null), false);
assert.equal(
  shouldShowSimilarSakerSection([
    {
      id: '1',
      title: 'Test',
      sesjon: '2024-2025',
      status: 'pending',
      statusLabel: 'Under behandling',
    },
  ]),
  true,
);

console.log('lib/sak/similar-issues.test.ts: ok');