import assert from 'node:assert/strict';
import { isSakKnowledgeQuizEnabled } from '@/lib/sak/flags';

const prev = process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;

delete process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;
assert.equal(isSakKnowledgeQuizEnabled(), false, 'mangler env → av');

process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ = '0';
assert.equal(isSakKnowledgeQuizEnabled(), false, '0 → av');

process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ = '1';
assert.equal(isSakKnowledgeQuizEnabled(), true, '1 → på');

if (prev === undefined) delete process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ;
else process.env.NEXT_PUBLIC_SAK_KNOWLEDGE_QUIZ = prev;

console.log('lib/sak/flags.test.ts: ok');