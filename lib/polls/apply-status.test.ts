import { nextPollStatusForAction } from '@/lib/polls/apply-status';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(nextPollStatusForAction('draft', 'publish').status === 'open', 'publish draft');
assert(nextPollStatusForAction('draft', 'archive').status === 'archived', 'archive draft');
assert(nextPollStatusForAction('open', 'archive').status === 'archived', 'archive open');

try {
  nextPollStatusForAction('open', 'publish');
  throw new Error('expected publish of open to fail');
} catch (error) {
  assert(error instanceof Error && error.message === 'Poll is not a draft', 'publish guard');
}

try {
  nextPollStatusForAction('archived', 'archive');
  throw new Error('expected archive of archived to fail');
} catch (error) {
  assert(error instanceof Error && error.message === 'Poll cannot be archived', 'archive guard');
}

console.log('poll apply-status tests OK');
