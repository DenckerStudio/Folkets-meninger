import assert from 'node:assert/strict';
import { chunkDocumentText } from './document-chunking';
import { htmlToPlainText, sanitizeStortingetHtml } from './html-document';

const html = `<!DOCTYPE html><html><head><script>alert(1)</script></head><body><p class="a">Hei verden.</p><p onclick="x()">Mer tekst.</p></body></html>`;
const sanitized = sanitizeStortingetHtml(html);
assert.ok(!sanitized.includes('<script'));
assert.ok(!sanitized.includes('onclick'));
assert.ok(sanitized.includes('Hei verden.'));

const text = htmlToPlainText(html);
assert.ok(text.includes('Hei verden.'));
assert.ok(text.includes('Mer tekst.'));

const long = 'Setning en. '.repeat(200);
const chunks = chunkDocumentText(long, { chunkSize: 120, overlap: 20 });
assert.ok(chunks.length > 1);
assert.ok(chunks.every((chunk) => chunk.length <= 140));

console.log('html-document.test.ts: ok');
