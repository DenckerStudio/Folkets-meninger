/**
 * Export excerpt-grounded stub answers for v2 test sample (faithfulness judge).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, databaseForVariant } from './lib/db';
import { retrieveForQuestion } from './lib/retrieval';
import { v2QuestionsPath } from './lib/v2-paths';

type Question = {
  id: string;
  kind: string;
  category: string;
  query: string;
  issueId?: string;
  hearingId?: string;
  gold?: { facts?: string[] };
  tags?: string[];
};

async function main(): Promise<void> {
  const label = process.env.RAG_EVAL_LABEL ?? 'v2-final';
  const sampleSize = Number(process.env.RAG_EVAL_V2_ANSWER_SAMPLE ?? 24);
  const questions = JSON.parse(readFileSync(v2QuestionsPath('test'), 'utf8')) as Question[];
  const sample = questions
    .filter((q) => q.kind !== 'issue_search' && q.kind !== 'finnes_ikke')
    .slice(0, sampleSize);

  const pool = createPool(databaseForVariant('stack'));
  const out: Array<Record<string, unknown>> = [];

  for (const q of sample) {
    const isHearingTopic = q.kind === 'topic' && q.tags?.includes('hearing');
    const kind = isHearingTopic ? 'hearing_topic' : q.kind;
    const { excerpts } = await retrieveForQuestion(pool, 'stack', {
      kind,
      query: q.query,
      issueId: q.issueId,
      hearingId: q.hearingId,
      k: 8,
    });
    const excerptTexts = excerpts.map((e) => e.content);
    const answer =
      excerptTexts.length === 0
        ? 'Fant ingen kilde i dokumentene for dette spørsmålet.'
        : `Basert på utdrag: ${excerptTexts.join(' ').slice(0, 1200)}`;
    out.push({
      id: q.id,
      category: q.category,
      query: q.query,
      answer,
      excerpts: excerptTexts,
      goldFacts: q.gold?.facts ?? [],
    });
  }
  await pool.end();

  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${label}-answers.json`);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`Wrote ${path} (${out.length} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
