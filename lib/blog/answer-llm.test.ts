import assert from 'node:assert/strict';
import {
  DEFAULT_BLOG_DRAFT_ANSWER_LLM_TIMEOUT_MS,
  resolveBlogDraftAnswerLlmTimeoutMs,
} from '@/lib/blog/answer-llm';

const prev = process.env.ANSWER_LLM_TIMEOUT_MS;

delete process.env.ANSWER_LLM_TIMEOUT_MS;
assert.equal(resolveBlogDraftAnswerLlmTimeoutMs(), DEFAULT_BLOG_DRAFT_ANSWER_LLM_TIMEOUT_MS);

process.env.ANSWER_LLM_TIMEOUT_MS = '600000';
assert.equal(resolveBlogDraftAnswerLlmTimeoutMs(), DEFAULT_BLOG_DRAFT_ANSWER_LLM_TIMEOUT_MS);

process.env.ANSWER_LLM_TIMEOUT_MS = '45000';
assert.equal(resolveBlogDraftAnswerLlmTimeoutMs(), 45000);

if (prev === undefined) delete process.env.ANSWER_LLM_TIMEOUT_MS;
else process.env.ANSWER_LLM_TIMEOUT_MS = prev;

console.log('lib/blog/answer-llm.test.ts ok');