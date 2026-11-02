import assert from 'node:assert/strict';
import {
  resolveStortingetPollAdminUiState,
  validateStortingetPollAdminAction,
  STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR,
  STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR,
  STORTINGET_POLL_ADMIN_ARCHIVED_ACTION_ERROR,
} from '@/lib/polls/stortinget-poll-admin-guard';

const stortingetOpen = {
  id: 'p1',
  track: 'stortinget',
  status: 'open',
  title: 'T',
  neutralSummary: '',
  closesAt: null,
};

assert.deepEqual(resolveStortingetPollAdminUiState([]), { kind: 'create' });

assert.deepEqual(
  resolveStortingetPollAdminUiState([
    { id: 'sys', track: 'system', status: 'open', title: 'S', neutralSummary: '', closesAt: null },
  ]),
  { kind: 'blocked_system_poll' },
);

assert.deepEqual(
  resolveStortingetPollAdminUiState([
    { id: 'sys', track: 'system', status: 'archived', title: 'S', neutralSummary: '', closesAt: null },
  ]),
  { kind: 'blocked_system_poll' },
);

assert.equal(resolveStortingetPollAdminUiState([stortingetOpen]).kind, 'editable');

assert.deepEqual(
  resolveStortingetPollAdminUiState([
    { id: 'd', track: 'stortinget', status: 'draft', title: 'Kladd', neutralSummary: '', closesAt: null },
  ]),
  { kind: 'stortinget_draft', pollId: 'd', title: 'Kladd' },
);

assert.deepEqual(
  resolveStortingetPollAdminUiState([
    { id: 'a', track: 'stortinget', status: 'archived', title: 'Ark', neutralSummary: '', closesAt: null },
  ]),
  { kind: 'stortinget_archived', pollId: 'a', title: 'Ark' },
);

const blockedAction = validateStortingetPollAdminAction(
  [{ id: 'sys', track: 'system', status: 'open', title: 'S', neutralSummary: '', closesAt: null }],
  { isUpdate: false },
);
assert.equal(blockedAction.ok, false);
if (blockedAction.ok) throw new Error('expected block');
assert.equal(blockedAction.error, STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR);

const draftAction = validateStortingetPollAdminAction(
  [{ id: 'd', track: 'stortinget', status: 'draft', title: 'K', neutralSummary: '', closesAt: null }],
  { isUpdate: false },
);
assert.equal(draftAction.ok, false);
if (draftAction.ok) throw new Error('expected draft block');
assert.equal(draftAction.error, STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR);

const archivedAction = validateStortingetPollAdminAction(
  [{ id: 'a', track: 'stortinget', status: 'archived', title: 'K', neutralSummary: '', closesAt: null }],
  { isUpdate: true },
);
assert.equal(archivedAction.ok, false);
if (archivedAction.ok) throw new Error('expected archived block');
assert.equal(archivedAction.error, STORTINGET_POLL_ADMIN_ARCHIVED_ACTION_ERROR);

console.log('stortinget-poll-admin-guard tests passed');
