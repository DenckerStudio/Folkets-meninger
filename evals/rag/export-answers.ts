/**
 * Export excerpt-grounded stub answers for the faithfulness judge (no external LLM).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, databaseForVariant } from './lib/db';
import { retrieveForQuestion } from './lib/retrieval';

type Question = {
  id: string;
  kind: string;
  query: string;
  issueId?: string;
  hearingId?: string;
  gold?: { facts?: string[] };
};

async function main(): Promise<void> {
  const label = process.env.RAG_EVAL_LABEL ?? 'stack';
  const questions = JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/questions.json'), 'utf8')) as Question[];
  const pool = createPool(databaseForVariant('stack'));
  const out: Array<Record<string, unknown>> = [];

  for (const q of questions) {
    if (q.kind === 'issue_search') continue;
    const kind =
      q.kind === 'topic'
        ? 'topic'
        : q.kind === 'finnes_ikke'
          ? 'finnes_ikke'
          : q.kind === 'hearing_chunk'
            ? 'hearing_chunk'
            : 'sak_chunk';
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
