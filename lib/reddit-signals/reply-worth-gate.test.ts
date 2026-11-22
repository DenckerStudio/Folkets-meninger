import assert from 'node:assert/strict';
import {
  isReplyWorthSuggested,
  passesReplyWorthGate,
  REPLY_WORTH_GATE,
  REPLY_WORTH_SUGGEST_THRESHOLD,
} from '@/lib/reddit-signals/reply-worth-gate';

const now = Date.parse('2026-11-22T12:00:00.000Z');

const base = {
  status: 'ny',
  postedAt: '2026-11-21T12:00:00.000Z',
  score: 20,
  numComments: 10,
  removalType: null,
  title: 'Hvorfor varsler folk stadig?',
};

assert.equal(passesReplyWorthGate(base, now).pass, true);

assert.equal(passesReplyWorthGate({ ...base, status: 'brukt' }, now).pass, false);
assert.equal(passesReplyWorthGate({ ...base, removalType: 'moderator' }, now).pass, false);
assert.equal(
  passesReplyWorthGate({ ...base, score: REPLY_WORTH_GATE.minScore - 1 }, now).pass,
  false,
);
assert.equal(
  passesReplyWorthGate({ ...base, numComments: REPLY_WORTH_GATE.minComments - 1 }, now).pass,
  false,
);
assert.equal(
  passesReplyWorthGate({ ...base, numComments: REPLY_WORTH_GATE.maxComments + 1 }, now).pass,
  false,
);
assert.equal(
  passesReplyWorthGate(
    { ...base, postedAt: '2026-11-18T12:00:00.000Z' },
    now,
  ).pass,
  false,
);
assert.equal(
  passesReplyWorthGate({ ...base, title: 'Hvilken bank er best?' }, now).pass,
  false,
);

assert.equal(isReplyWorthSuggested(REPLY_WORTH_SUGGEST_THRESHOLD), true);
assert.equal(isReplyWorthSuggested(3), false);
assert.equal(isReplyWorthSuggested(null), false);

console.log('lib/reddit-signals/reply-worth-gate.test.ts: ok');
