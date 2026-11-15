import assert from 'node:assert/strict';
import { USER_ANNOTATION_EXPAND_EVENT } from '@/lib/user-annotations/expand-container';

assert.equal(USER_ANNOTATION_EXPAND_EVENT, 'fm-user-annotation-expand');

console.log('user-annotations/reveal-annotation.test.ts: ok');