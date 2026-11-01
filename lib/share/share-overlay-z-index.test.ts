import assert from 'node:assert/strict';
import { SHARE_DIALOG_OVERLAY_Z_INDEX } from '@/lib/share/share-overlay-z-index';

assert.equal(SHARE_DIALOG_OVERLAY_Z_INDEX, 450);
assert.ok(SHARE_DIALOG_OVERLAY_Z_INDEX > 400, 'above reel expanded panel');

console.log('share overlay z-index: ok');
