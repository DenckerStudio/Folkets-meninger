import assert from 'node:assert/strict';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import {
  buildStortingetPollSourceUrls,
  norwegianClosesAtToWire,
  publishStortingetPollForAdmin,
  runPublishStortingetPollAdminAction,
  validatePublishStortingetPollInput,
  validateStortingetPollAdminForm,
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

async function main() {
  const adminDenied = await runPublishStortingetPollAdminAction(
    { issueId: '999001', title: 'Skal eksempelsaken vedtas?' },
    {
      isAdmin: false,
      deps: {
        ensureStortingetPoll: async () => 'should-not-run',
        setPollClosesAt: async () => {},
      },
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

  const publishOk = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Skal eksempelsaken vedtas?',
      neutralSummary: 'Nøytral ingress for test.',
      closesAtDate: futureDate,
      closesAtTime: futureTime,
    },
    {
      ensureStortingetPoll: async (input) => {
        capturedEnsureInput = input;
        return 'poll-uuid-1';
      },
      setPollClosesAt: async (_pollId, iso) => {
        closesAtWritten = iso;
      },
    },
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
    {
      ensureStortingetPoll: async () => 'poll-uuid-1',
      setPollClosesAt: async (_pollId, iso) => {
        clearedTo = iso;
      },
    },
    fixedNow,
  );
  assert.equal(clearOk.ok, true);
  assert.equal(clearedTo, null);

  console.log('stortinget-poll-admin tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
