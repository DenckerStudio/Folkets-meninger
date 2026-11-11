import assert from 'node:assert/strict';
import {
  buildDevTaskProposalDecisionPatch,
  resolveDevTaskProposalDecision,
} from '@/lib/admin/dev-task-proposals/transitions';

const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = '2026-11-11T10:00:00.000Z';

const godkjenn = resolveDevTaskProposalDecision('til_godkjenning', 'godkjenn');
assert.equal(godkjenn.ok, true);
if (godkjenn.ok) {
  assert.equal(godkjenn.nextStatus, 'i_prosess');
  const patch = buildDevTaskProposalDecisionPatch(godkjenn, adminId, now);
  assert.deepEqual(patch, {
    status: 'i_prosess',
    decided_by: adminId,
    decided_at: now,
  });
}

const avslå = resolveDevTaskProposalDecision('til_godkjenning', 'avslå');
assert.equal(avslå.ok, true);
if (avslå.ok) {
  assert.equal(avslå.nextStatus, 'avslatt');
  const patch = buildDevTaskProposalDecisionPatch(avslå, adminId, now);
  assert.deepEqual(patch, {
    status: 'avslatt',
    decided_by: adminId,
    decided_at: now,
  });
}

const blocked = resolveDevTaskProposalDecision('i_prosess', 'godkjenn');
assert.equal(blocked.ok, false);

const blockedReject = resolveDevTaskProposalDecision('ferdig', 'avslå');
assert.equal(blockedReject.ok, false);

console.log('dev-task-proposals/transitions.test.ts: ok');
