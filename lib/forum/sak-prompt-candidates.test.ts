import assert from 'node:assert/strict';
import { filterSakPromptCandidates } from '@/lib/forum/sak-prompt-candidates';

const issues = [
  {
    id: '100',
    title: 'Med RAG',
    category: 'klima',
    first_seen_at: '2026-01-01T00:00:00Z',
    last_updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: '200',
    title: 'Uten RAG',
    category: null,
    first_seen_at: '2026-01-01T00:00:00Z',
    last_updated_at: '2026-06-01T00:00:00Z',
  },
  {
    id: '300',
    title: 'Har allerede prompt',
    category: null,
    first_seen_at: '2026-01-01T00:00:00Z',
    last_updated_at: '2026-06-01T00:00:00Z',
  },
];

const ragCount = new Map([
  ['100', 4],
  ['300', 2],
]);
const summaries = new Set(['100']);
const prompts = new Set(['300']);

const candidates = filterSakPromptCandidates(issues, ragCount, summaries, prompts);

assert.equal(candidates.length, 1);
assert.equal(candidates[0]?.issueId, '100');
assert.equal(candidates[0]?.ragChunkCount, 4);
assert.equal(candidates[0]?.hasAiSummary, true);

console.log('sak-prompt-candidates.test.ts: ok');
