/**
 * Export LLM-synthesized answers for v2 test sample (faithfulness judge).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, databaseForVariant } from './lib/db';
import { extractSourceKeys } from './lib/answer-metrics';
import { generateRagAnswer, resolveAnswerLlmConfig } from './lib/generate-rag-answer';
import { retrieveForQuestion } from './lib/retrieval';
import { v2QuestionsPath } from './lib/v2-paths';

type Question = {
  id: string;
  kind: string;
  category: string;
  query: string;
  issueId?: string;
  hearingId?: string;
  gold?: { facts?: string[]; issueIds?: string[] };
  tags?: string[];
};

type AnswerRow = {
  id: string;
  category: string;
  query: string;
  answer: string;
  excerpts: string[];
  goldFacts: string[];
  generationError?: string;
  answerModel?: string;
  answerLlmUrl?: string;
  retrievalDocumentIds?: string[];
  retrievalSourceKeys?: string[];
};

async function main(): Promise<void> {
  const label = process.env.RAG_EVAL_LABEL ?? 'v2-final';
  const sampleSize = Number(process.env.RAG_EVAL_V2_ANSWER_SAMPLE ?? 24);
  const llm = resolveAnswerLlmConfig();
  const questions = JSON.parse(readFileSync(v2QuestionsPath('test'), 'utf8')) as Question[];
  const sample = questions
    .filter((q) => q.kind !== 'issue_search' && q.kind !== 'finnes_ikke')
    .slice(0, sampleSize);

  const pool = createPool(databaseForVariant('stack'));
  const out: AnswerRow[] = [];
  let failures = 0;

  for (const q of sample) {
    const isHearingTopic = q.kind === 'topic' && q.tags?.includes('hearing');
    const kind = isHearingTopic ? 'hearing_topic' : q.kind;
    const { excerpts, rows: retrievedRows } = await retrieveForQuestion(pool, 'stack', {
      kind,
      query: q.query,
      issueId: q.issueId,
      hearingId: q.hearingId,
      issueIds: q.gold?.issueIds,
      k: 8,
    });
    const excerptTexts = excerpts.map((e) => e.content);
    const retrievalSourceKeys = extractSourceKeys(excerptTexts.join('\n'));
    const retrievalDocumentIds = [...new Set(retrievedRows.map((r) => r.documentId).filter(Boolean))];
    const row: AnswerRow = {
      id: q.id,
      category: q.category,
      query: q.query,
      answer: '',
      excerpts: excerptTexts,
      goldFacts: q.gold?.facts ?? [],
      answerModel: llm.model,
      answerLlmUrl: llm.baseUrl,
      retrievalDocumentIds,
      retrievalSourceKeys,
    };
    try {
      row.answer = await generateRagAnswer({
        query: q.query,
        excerpts: excerptTexts,
        baseUrl: llm.baseUrl,
        model: llm.model,
        timeoutMs: llm.timeoutMs,
        numPredict: llm.numPredict,
        think: llm.think,
      });
    } catch (err) {
      failures += 1;
      row.generationError = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[answers] ${q.id} ERROR: ${row.generationError}\n`);
    }
    out.push(row);
  }
  await pool.end();

  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${label}-answers.json`);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${path} (${out.length} rows, ${failures} generation error(s))`);
  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
