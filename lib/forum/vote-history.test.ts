import assert from 'node:assert/strict';
import {
  normalizeForumVoteHistory,
  summarizeForumVoteHistory,
  topForumVoteTopics,
} from './vote-history';

const rows = normalizeForumVoteHistory([
  {
    prompt_id: 'p1',
    option_id: 'ja',
    voted_at: '2026-07-22T10:00:00.000Z',
    question: '(Jeg mener) Norge bør si ja',
    stortinget_issue_id: '123',
    sak_title: 'Test sak',
    topic_tags: ['sak_mening', 'økonomi'],
  },
  {
    prompt_id: 'p2',
    option_id: 'nei',
    voted_at: '2026-07-21T10:00:00.000Z',
    question: 'Skal vi øke bistanden?',
    stortinget_issue_id: null,
    sak_title: null,
    topic_tags: ['utenrikspolitikk'],
  },
]);

assert.equal(rows.length, 2);
assert.equal(rows[0]?.option_label, 'Ja');

const summary = summarizeForumVoteHistory(rows);
assert.equal(summary.total, 2);
assert.equal(summary.ja, 1);
assert.equal(summary.nei, 1);
assert.equal(summary.unique_saker, 1);

const topics = topForumVoteTopics(rows);
assert.deepEqual(topics, [
  { tag: 'økonomi', count: 1 },
  { tag: 'utenrikspolitikk', count: 1 },
]);

console.log('forum vote-history tests passed');
