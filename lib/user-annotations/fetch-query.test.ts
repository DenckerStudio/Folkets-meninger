import assert from 'node:assert/strict';
import { annotationFetchQueryKey } from '@/lib/user-annotations/fetch-query';

assert.equal(annotationFetchQueryKey('sak', '103102'), 'sak:103102');
assert.equal(annotationFetchQueryKey('research', 'abc'), 'research:abc');
assert.equal(annotationFetchQueryKey('sak', ' 103102 '), 'sak:103102');

console.log('user-annotations/fetch-query.test.ts: ok');