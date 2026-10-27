import assert from 'node:assert/strict';
import {
  adminReelDraftListLabel,
  adminReelDraftWaitingDescription,
} from '@/lib/admin/reel-draft-list-label';

assert.equal(adminReelDraftListLabel(50, 65), 'Viser 50 av 65');
assert.equal(adminReelDraftListLabel(50, 50), '50');
assert.equal(adminReelDraftListLabel(0, 65), '0');

assert.match(adminReelDraftWaitingDescription(50, 65), /Viser 50 av 65/);
assert.match(adminReelDraftWaitingDescription(3, 3), /3 utkast venter/);

console.log('admin/reel-draft-list-label.test.ts: ok');
