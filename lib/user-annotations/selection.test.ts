import assert from 'node:assert/strict';
import { buildHighlightSegments } from '@/lib/user-annotations/selection';

const text = 'abcdefgh';
const segments = buildHighlightSegments(text, [
  { id: 'a', start_offset: 1, end_offset: 3 },
  { id: 'b', start_offset: 5, end_offset: 7 },
]);

assert.deepEqual(segments, [
  { text: 'a', highlighted: false },
  { text: 'bc', highlighted: true, annotationId: 'a' },
  { text: 'de', highlighted: false },
  { text: 'fg', highlighted: true, annotationId: 'b' },
  { text: 'h', highlighted: false },
]);

console.log('user-annotations/selection.test.ts: ok');