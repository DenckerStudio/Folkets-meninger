import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dialogSource = readFileSync(
  join(process.cwd(), 'components/ui/dialog.tsx'),
  'utf8',
);

assert.match(dialogSource, /document\.activeElement/);
assert.match(dialogSource, /dialogRef\.current/);
assert.match(dialogSource, /\.focus\(\)/);
assert.match(dialogSource, /event\.key [!=]== ['"]Tab['"]/);
assert.match(dialogSource, /event\.shiftKey/);
assert.match(dialogSource, /firstFocusable/);
assert.match(dialogSource, /lastFocusable/);
assert.match(dialogSource, /element\.tabIndex >= 0/);
assert.match(dialogSource, /element\.matches\(['"]:disabled['"]\)/);
assert.match(dialogSource, /getComputedStyle\(element\)\.visibility/);
assert.match(dialogSource, /event\.preventDefault\(\)/);
assert.match(dialogSource, /\.isConnected/);
assert.match(dialogSource, /tabIndex=\{-1\}/);
assert.match(dialogSource, /event\.key === ['"]Escape['"]/);

console.log('dashboard/dialog-accessibility.test.ts: ok');
