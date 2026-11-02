import assert from 'node:assert/strict';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import {
  STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR,
  STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR,
} from '@/lib/polls/stortinget-poll-admin-guard';
import type { IssuePollAdminRow, StortingetIssueTextSnapshot } from '@/lib/polls/stortinget-poll-admin-guard';
import {
  buildStortingetPollSourceUrls,
  norwegianClosesAtToWire,
  publishStortingetPollForAdmin,
  runPublishStortingetPollAdminAction,
  validatePublishStortingetPollInput,
  validateStortingetPollAdminForm,
  type PublishStortingetPollDeps,
} from '@/lib/polls/stortinget-poll-admin';

const fixedNow = new Date('2026-11-02T10:00:00.000Z');
const pastWire = '2020-01-01T11:00';
const futureDate = '15.06.2099';
const futureTime = '12:00';

assert.deepEqual(POLL_BALLOT_BUTTON_ORDER, ['nei', 'blank', 'ja']);
assert.equal(pollChoiceLabel('nei'), 'Nei');
assert.equal(pollChoiceLabel('blank'), 'Blank');
assert.equal(pollChoiceLabel('ja'), 'Ja');
assert.equal(norwegianClosesAtToWire(futureDate, futureTime), '2099-06-15T12:00');

const missingTitle = validatePublishStortingetPollInput(
  { issueId: '999001', title: '   ', neutralSummary: '' },
  fixedNow,
);
assert.equal(missingTitle.ok, false);
if (missingTitle.ok) throw new Error('expected validation failure');
assert.match(missingTitle.error, /tittel/i);

const pastCloseCreate = validatePublishStortingetPollInput(
  {
    issueId: '999001',
    title: 'Skal eksempelsaken vedtas?',
    neutralSummary: '',
    closesAtDate: '01.01.2020',
    closesAtTime: '10:00',
  },
  fixedNow,
);
assert.equal(pastCloseCreate.ok, false);
if (pastCloseCreate.ok) throw new Error('expected past closes_at failure');
assert.match(pastCloseCreate.error, /fremtiden/i);

const updateUnchangedPast = validatePublishStortingetPollInput(
  {
    issueId: '999001',
    title: 'Oppdatert tittel',
    neutralSummary: '',
    isUpdate: true,
    initialClosesAtWire: pastWire,
    closesAtDate: '01.01.2020',
    closesAtTime: '11:00',
  },
  fixedNow,
);
assert.equal(updateUnchangedPast.ok, true);
if (!updateUnchangedPast.ok) throw new Error('expected update unchanged ok');
assert.equal(updateUnchangedPast.value.closesAt.action, 'skip');

const updateChangedPast = validatePublishStortingetPollInput(
  {
    issueId: '999001',
    title: 'Oppdatert tittel',
    neutralSummary: '',
    isUpdate: true,
    initialClosesAtWire: pastWire,
    closesAtDate: '01.01.2021',
    closesAtTime: '10:00',
  },
  fixedNow,
);
assert.equal(updateChangedPast.ok, false);
if (updateChangedPast.ok) throw new Error('expected changed past to fail');
assert.match(updateChangedPast.error, /senere dato/i);

const clientPast = validateStortingetPollAdminForm(
  {
    issueId: '999001',
    title: 'Tittel',
    neutralSummary: '',
    closesAtDate: '01.01.2020',
    closesAtTime: '09:00',
  },
  fixedNow,
);
assert.equal(clientPast.ok, false);

function baseDeps(overrides: Partial<PublishStortingetPollDeps> = {}): PublishStortingetPollDeps {
  return {
    listIssuePolls: async () => [],
    readIssueSnapshot: async () => null,
    restoreIssueSnapshot: async () => {},
    ensureStortingetPoll: async () => 'poll-uuid-1',
    setPollClosesAt: async () => {},
    ...overrides,
  };
}

async function main() {
  const adminDenied = await runPublishStortingetPollAdminAction(
    { issueId: '999001', title: 'Skal eksempelsaken vedtas?' },
    {
      isAdmin: false,
      deps: baseDeps({
        ensureStortingetPoll: async () => 'should-not-run',
      }),
    },
  );
  assert.equal(adminDenied.ok, false);
  if (adminDenied.ok) throw new Error('expected admin gate failure');
  assert.equal(adminDenied.error, 'Ingen tilgang');

  type CapturedEnsureInput = {
    issueId: string;
    title: string;
    neutralSummary?: string;
    sourceUrls?: { url: string; label?: string }[];
  };

  let capturedEnsureInput: CapturedEnsureInput | undefined;
  let closesAtWritten: string | null | undefined;
  let ensureCallCount = 0;

  const publishOk = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Skal eksempelsaken vedtas?',
      neutralSummary: 'Nøytral ingress for test.',
      closesAtDate: futureDate,
      closesAtTime: futureTime,
    },
    baseDeps({
      ensureStortingetPoll: async (input) => {
        ensureCallCount += 1;
        capturedEnsureInput = input;
        return 'poll-uuid-1';
      },
      setPollClosesAt: async (_pollId, iso) => {
        closesAtWritten = iso;
      },
    }),
    fixedNow,
  );

  assert.equal(publishOk.ok, true);
  if (!publishOk.ok) throw new Error('expected publish ok');
  assert.equal(publishOk.pollId, 'poll-uuid-1');
  assert.ok(capturedEnsureInput, 'ensureStortingetPoll should be called');
  assert.equal(capturedEnsureInput.issueId, '999001');
  assert.deepEqual(capturedEnsureInput.sourceUrls, buildStortingetPollSourceUrls('999001'));
  assert.ok(closesAtWritten);
  assert.ok(new Date(closesAtWritten!).getTime() > fixedNow.getTime());

  let clearedTo: string | null | undefined = 'not-called';
  const openRow: IssuePollAdminRow = {
    id: 'poll-uuid-1',
    track: 'stortinget',
    status: 'open',
    title: 'T',
    neutralSummary: '',
    closesAt: pastWire,
  };
  const clearOk = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Oppdatert',
      neutralSummary: '',
      isUpdate: true,
      initialClosesAtWire: pastWire,
      closesAtDate: '',
      closesAtTime: '',
    },
    baseDeps({
      listIssuePolls: async () => [openRow],
      setPollClosesAt: async (_pollId, iso) => {
        clearedTo = iso;
      },
    }),
    fixedNow,
  );
  assert.equal(clearOk.ok, true);
  assert.equal(clearedTo, null);

  ensureCallCount = 0;
  const systemOpenBlock = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Skal eksempelsaken vedtas?',
      neutralSummary: '',
    },
    baseDeps({
      listIssuePolls: async () => [
        { id: 'sys', track: 'system', status: 'open', title: 'S', neutralSummary: '', closesAt: null },
      ],
      ensureStortingetPoll: async () => {
        ensureCallCount += 1;
        return 'bad';
      },
    }),
    fixedNow,
  );
  assert.equal(systemOpenBlock.ok, false);
  if (systemOpenBlock.ok) throw new Error('expected system block');
  assert.equal(systemOpenBlock.error, STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR);
  assert.equal(ensureCallCount, 0);

  ensureCallCount = 0;
  const systemArchivedBlock = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Skal eksempelsaken vedtas?',
      neutralSummary: '',
    },
    baseDeps({
      listIssuePolls: async () => [
        { id: 'sys', track: 'system', status: 'archived', title: 'S', neutralSummary: '', closesAt: null },
      ],
      ensureStortingetPoll: async () => {
        ensureCallCount += 1;
        return 'bad';
      },
    }),
    fixedNow,
  );
  assert.equal(systemArchivedBlock.ok, false);
  assert.equal(ensureCallCount, 0);

  ensureCallCount = 0;
  const draftBlock = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'T',
      neutralSummary: '',
    },
    baseDeps({
      listIssuePolls: async () => [
        { id: 'd', track: 'stortinget', status: 'draft', title: 'K', neutralSummary: '', closesAt: null },
      ],
      ensureStortingetPoll: async () => {
        ensureCallCount += 1;
        return 'bad';
      },
    }),
    fixedNow,
  );
  assert.equal(draftBlock.ok, false);
  if (draftBlock.ok) throw new Error('expected draft block');
  assert.equal(draftBlock.error, STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR);
  assert.equal(ensureCallCount, 0);

  const issueSnapshot: StortingetIssueTextSnapshot = {
    title: 'Offisiell sakstittel',
    summary: 'Offisiell ingress',
  };
  let restored: StortingetIssueTextSnapshot | null = null;

  await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Poll-tittel ved opprett',
      neutralSummary: '',
    },
    baseDeps({
      readIssueSnapshot: async () => ({ ...issueSnapshot }),
      restoreIssueSnapshot: async (_issueId, snap) => {
        restored = snap;
      },
    }),
    fixedNow,
  );
  assert.deepEqual(restored, issueSnapshot);

  restored = null;
  await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Poll-tittel ved redigering',
      neutralSummary: '',
      isUpdate: true,
    },
    baseDeps({
      listIssuePolls: async () => [openRow],
      readIssueSnapshot: async () => ({ ...issueSnapshot }),
      restoreIssueSnapshot: async (_issueId, snap) => {
        restored = snap;
      },
    }),
    fixedNow,
  );
  assert.deepEqual(restored, issueSnapshot);

  console.log('stortinget-poll-admin tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
