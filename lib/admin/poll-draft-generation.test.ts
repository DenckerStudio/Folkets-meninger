import {
  findCompletedDraft,
  isPollDraftGenerationTimedOut,
  pollDraftGenerationKey,
} from '@/lib/admin/poll-draft-generation';
import type { PollRecord } from '@/lib/polls/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const basePoll = (overrides: Partial<PollRecord>): PollRecord => ({
  id: 'poll-1',
  track: 'system',
  status: 'draft',
  title: 'Test',
  neutralSummary: '',
  sourceUrls: [],
  stortingetIssueId: 'sak-1',
  citizenInitiativeId: null,
  opensAt: null,
  closesAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  generationMetadata: {},
  ...overrides,
});

assert(pollDraftGenerationKey() === '__next__', 'next key');
assert(pollDraftGenerationKey('abc') === 'abc', 'issue key');

const issueJob = {
  key: 'sak-1',
  issueId: 'sak-1',
  startedAt: Date.now(),
  status: 'generating' as const,
  knownDraftIds: [],
};

const drafts = [
  basePoll({ id: 'existing', stortingetIssueId: 'sak-2' }),
  basePoll({ id: 'new-draft', stortingetIssueId: 'sak-1' }),
];

assert(findCompletedDraft(issueJob, drafts)?.id === 'new-draft', 'find by issue');

const nextJob = {
  key: '__next__',
  issueId: null,
  startedAt: Date.now(),
  status: 'generating' as const,
  knownDraftIds: ['existing'],
};

assert(findCompletedDraft(nextJob, drafts)?.id === 'new-draft', 'find next draft');

assert(
  isPollDraftGenerationTimedOut({ ...nextJob, startedAt: Date.now() - 120_000 }),
  'timeout',
);
assert(!isPollDraftGenerationTimedOut({ ...nextJob, startedAt: Date.now() }), 'not timeout');

console.log('poll draft generation tests OK');
