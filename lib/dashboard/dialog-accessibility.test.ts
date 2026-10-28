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
assert.match(dialogSource, /const openDialogs: HTMLElement\[\] = \[\]/);
assert.match(dialogSource, /const dialogRestoreTargets = new WeakMap/);
assert.match(dialogSource, /openDialogs\.at\(-1\) !== dialog/);
assert.match(dialogSource, /const wasTopmost = openDialogs\.at\(-1\) === dialog/);
assert.match(dialogSource, /if \(wasTopmost\) \{\s*restoreFocus/);
assert.match(dialogSource, /\[open, mounted\]/);
assert.match(dialogSource, /['"]iframe['"]/);
assert.match(dialogSource, /['"]summary['"]/);
assert.match(dialogSource, /['"]audio\[controls\]['"]/);
assert.match(dialogSource, /['"]video\[controls\]['"]/);
assert.match(dialogSource, /\[contenteditable="plaintext-only"/);
assert.match(dialogSource, /element\.tabIndex >= 0/);
assert.match(dialogSource, /element\.matches\(['"]:disabled['"]\)/);
assert.match(dialogSource, /getComputedStyle\(element\)\.visibility/);
assert.match(dialogSource, /event\.preventDefault\(\)/);
assert.match(dialogSource, /event\.defaultPrevented/);
assert.match(dialogSource, /\.isConnected/);
assert.match(dialogSource, /data-shared-dialog/);
assert.match(dialogSource, /openDialogs\.includes\(previouslyFocusedDialog\)/);
assert.match(dialogSource, /tabIndex=\{-1\}/);
assert.match(dialogSource, /event\.key === ['"]Escape['"]/);
assert.match(
  dialogSource,
  /openDialogs\.at\(-1\) !== dialog[\s\S]*?event\.defaultPrevented[\s\S]*?event\.key === ['"]Escape['"][\s\S]*?event\.key !== ['"]Tab['"]/,
);

assert.match(dialogSource, /data-shared-dialog-backdrop/);
assert.match(dialogSource, /data-shared-dialog-overlay/);
assert.match(
  dialogSource,
  /<div\s+className="absolute inset-0[\s\S]*?data-shared-dialog-backdrop[\s\S]*?onClick=\{onClose\}/,
);
assert.doesNotMatch(dialogSource, /<button[\s\S]*?className="absolute inset-0/);
assert.doesNotMatch(dialogSource, /aria-label="Lukk"/);
assert.match(dialogSource, /aria-label="Lukk dialog"/);

assert.match(dialogSource, /DIALOG_Z_INDEX_BASE = 80/);
assert.match(dialogSource, /DIALOG_Z_INDEX_STEP/);
assert.match(
  dialogSource,
  /zIndex:\s*DIALOG_Z_INDEX_BASE \+ stackIndex \* DIALOG_Z_INDEX_STEP/,
);
assert.match(dialogSource, /setStackIndex\(openDialogs\.length\)/);
assert.match(dialogSource, /z-\[80\]/);

assert.match(dialogSource, /addEventListener\(['"]keydown['"], onKey, true\)/);
assert.match(dialogSource, /removeEventListener\(['"]keydown['"], onKey, true\)/);
assert.match(
  dialogSource,
  /event\.key === ['"]Escape['"][\s\S]*?event\.stopPropagation\(\)/,
);

assert.match(dialogSource, /function isOverlayElement/);
assert.match(
  dialogSource,
  /\[data-shared-dialog-overlay\], \[data-shared-dialog-backdrop\]/,
);
assert.match(dialogSource, /isOverlayElement\(focusTarget\)/);
assert.match(
  dialogSource,
  /previouslyFocusedDialog && !openDialogs\.includes\(previouslyFocusedDialog\)/,
);

console.log('dashboard/dialog-accessibility.test.ts: ok');
