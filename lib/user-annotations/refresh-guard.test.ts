/**
 * Kontrakt: refresh skal bare trigges når query-nøkkel endres, ikke ved hver context-re-render.
 * (Verifiserer nøkkelstabilitet som proxy for effekt-avhengigheter i provider.)
 */
import assert from 'node:assert/strict';
import { annotationFetchQueryKey } from '@/lib/user-annotations/fetch-query';

const keyA = annotationFetchQueryKey('sak', '1');
const keyB = annotationFetchQueryKey('sak', '1');
const keyC = annotationFetchQueryKey('sak', '2');

assert.equal(keyA, keyB);
assert.notEqual(keyA, keyC);

console.log('user-annotations/refresh-guard.test.ts: ok');