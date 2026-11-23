import assert from 'node:assert/strict';
import { sakNummerMetaSessionPart } from '@/lib/sak/sak-meta-display';

assert.equal(sakNummerMetaSessionPart('2025-2026'), '(2025-2026)');
assert.equal(sakNummerMetaSessionPart(' 2024-2025 '), '(2024-2025)');
assert.equal(sakNummerMetaSessionPart('(2023-2024)'), '(2023-2024)');

console.log('lib/sak/sak-meta-display.test.ts: ok');