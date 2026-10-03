import { isPollAlreadyExistsError, normalizePollIssueId } from '@/lib/polls/already-exists';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(normalizePollIssueId(' 200384 ') === '200384', 'trim issue id');
assert(normalizePollIssueId(200369) === '200369', 'numeric issue id');
assert(normalizePollIssueId(null) === null, 'null issue id');
assert(normalizePollIssueId('   ') === null, 'blank issue id');

assert(
  isPollAlreadyExistsError(new Error('Poll already exists for issue')),
  'error message',
);
assert(
  isPollAlreadyExistsError({ message: 'P0001', details: 'Poll already exists for issue' }),
  'supabase details',
);
assert(!isPollAlreadyExistsError(new Error('Missing title')), 'other error');

console.log('poll already-exists tests OK');
