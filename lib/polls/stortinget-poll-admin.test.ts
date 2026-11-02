import assert from 'node:assert/strict';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import {
  buildStortingetPollSourceUrls,
  publishStortingetPollForAdmin,
  runPublishStortingetPollAdminAction,
  validatePublishStortingetPollInput,
} from '@/lib/polls/stortinget-poll-admin';

const futureOslo = '2099-06-15T12:00';
const fixedNow = new Date('2026-11-02T10:00:00.000Z');

assert.deepEqual(POLL_BALLOT_BUTTON_ORDER, ['nei', 'blank', 'ja']);
assert.equal(pollChoiceLabel('nei'), 'Nei');
assert.equal(pollChoiceLabel('blank'), 'Blank');
assert.equal(pollChoiceLabel('ja'), 'Ja');

const missingTitle = validatePublishStortingetPollInput(
  { issueId: '999001', title: '   ', neutralSummary: '' },
  fixedNow,
);
assert.equal(missingTitle.ok, false);
if (missingTitle.ok) throw new Error('expected validation failure');
assert.match(missingTitle.error, /tittel/i);

const pastClose = validatePublishStortingetPollInput(
  {
    issueId: '999001',
    title: 'Skal eksempelsaken vedtas?',
    neutralSummary: '',
    closesAtOslo: '2020-01-01T10:00',
  },
  fixedNow,
);
assert.equal(pastClose.ok, false);
if (pastClose.ok) throw new Error('expected past closes_at failure');
assert.match(pastClose.error, /fremtiden/i);

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
  let closesAtWritten: string | null = null;

  const publishOk = await publishStortingetPollForAdmin(
    {
      issueId: '999001',
      title: 'Skal eksempelsaken vedtas?',
      neutralSummary: 'Nøytral ingress for test.',
      closesAtOslo: futureOslo,
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
  assert.equal(capturedEnsureInput.title, 'Skal eksempelsaken vedtas?');
  assert.equal(capturedEnsureInput.neutralSummary, 'Nøytral ingress for test.');
  assert.deepEqual(capturedEnsureInput.sourceUrls, buildStortingetPollSourceUrls('999001'));
  assert.equal(
    capturedEnsureInput.sourceUrls?.[0]?.url,
    'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=999001',
  );
  assert.ok(closesAtWritten);
  assert.ok(new Date(closesAtWritten!).getTime() > fixedNow.getTime());

  console.log('stortinget-poll-admin tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
