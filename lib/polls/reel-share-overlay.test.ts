import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

const shell = read('components/polls/reel-expanded-shell.tsx');
const shareDialog = read('components/share/share-dialog.tsx');
const dialog = read('components/ui/dialog.tsx');

assert.match(shell, /useFocusTrap\(open && !shareDialogOpen/, 'reel trap pauses while share open');
assert.match(shell, /ReelExpandedShareProvider/, 'reel share provider wraps expanded content');
assert.match(shareDialog, /SHARE_DIALOG_OVERLAY_Z_INDEX/, 'share dialog raises overlay z-index');
assert.match(shareDialog, /overlayZIndex=\{overlayTop \? SHARE_DIALOG_OVERLAY_Z_INDEX/, 'share passes overlay z-index to Dialog');
assert.doesNotMatch(shareDialog, /requestAnimationFrame/, 'no rAF z-index workaround');
assert.match(shareDialog, /mode="popLayout"/, 'copy icon swap keeps stable width');
assert.doesNotMatch(dialog, /SHARE_DIALOG/, 'base dialog unchanged');
assert.match(read('components/polls/reel-poll-share-del.tsx'), /ReelPollShareDel/, 'isolated reel del');

console.log('reel share overlay: ok');
