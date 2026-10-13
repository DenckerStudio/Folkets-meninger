import assert from 'node:assert/strict';
import { parseMarkdown } from './markdown';

const blocks = parseMarkdown(
  [
    'Dette er **viktig** og *lett* å lese.',
    '',
    '- ett punkt',
    '- et [annet](https://stortinget.no) punkt',
    '',
    '1. først',
    '2. sist',
    '',
    '## Overskrift',
    '',
    '```',
    'kode **ikke fet**',
    '```',
  ].join('\n'),
);

assert.equal(blocks.length, 5);

const [paragraph, unordered, ordered, heading, code] = blocks;
assert.equal(paragraph.type, 'paragraph');
if (paragraph.type === 'paragraph') {
  assert.deepEqual(paragraph.nodes, [
    { type: 'text', value: 'Dette er ' },
    { type: 'strong', value: 'viktig' },
    { type: 'text', value: ' og ' },
    { type: 'em', value: 'lett' },
    { type: 'text', value: ' å lese.' },
  ]);
}

assert.equal(unordered.type, 'list');
if (unordered.type === 'list') {
  assert.equal(unordered.ordered, false);
  assert.equal(unordered.items.length, 2);
  assert.deepEqual(unordered.items[1], [
    { type: 'text', value: 'et ' },
    { type: 'link', value: 'annet', href: 'https://stortinget.no' },
    { type: 'text', value: ' punkt' },
  ]);
}

assert.equal(ordered.type, 'list');
if (ordered.type === 'list') assert.equal(ordered.ordered, true);

assert.equal(heading.type, 'heading');
if (heading.type === 'heading') {
  assert.equal(heading.level, 2);
  assert.deepEqual(heading.nodes, [{ type: 'text', value: 'Overskrift' }]);
}

assert.equal(code.type, 'code');
if (code.type === 'code') assert.equal(code.value, 'kode **ikke fet**');

// Bare links stay literal text (no javascript: URLs).
const unsafe = parseMarkdown('[klikk](javascript:alert(1))');
assert.equal(unsafe.length, 1);
if (unsafe[0].type === 'paragraph') {
  assert.deepEqual(unsafe[0].nodes, [{ type: 'text', value: '[klikk](javascript:alert(1))' }]);
}

// Plain prose never disappears.
assert.deepEqual(parseMarkdown('bare tekst'), [
  { type: 'paragraph', nodes: [{ type: 'text', value: 'bare tekst' }] },
]);

console.log('chat/markdown.test.ts: ok');
