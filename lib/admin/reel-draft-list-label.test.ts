import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  adminReelDraftListLabel,
  adminReelDraftWaitingDescription,
} from '@/lib/admin/reel-draft-list-label';

assert.equal(adminReelDraftListLabel(50, 65), 'Viser 50 av 65');
assert.equal(adminReelDraftListLabel(50, 50), '50');
assert.equal(adminReelDraftListLabel(0, 65), '0');

assert.equal(
  adminReelDraftWaitingDescription(50, 65),
  '65 utkast venter på publisering eller arkivering (viser de 50 nyeste).',
);
assert.equal(
  adminReelDraftWaitingDescription(50, 65, false),
  '65 utkast venter på publisering eller arkivering (viser 50).',
);
assert.equal(
  adminReelDraftWaitingDescription(3, 3),
  '3 utkast venter på publisering eller arkivering.',
);
assert.equal(
  adminReelDraftWaitingDescription(1, 1),
  '1 utkast venter på publisering eller arkivering.',
);

const pollsService = readFileSync(join(process.cwd(), 'lib/polls/service.ts'), 'utf8');
assert.match(pollsService, /listSystemPollDrafts[\s\S]*\.order\('created_at', \{ ascending: false \}\)/);

console.log('admin/reel-draft-list-label.test.ts: ok');
