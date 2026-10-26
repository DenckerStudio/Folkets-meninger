/**
 * Calibrate RAG_REJECTION_THRESHOLD on questions-dev.json (never the test split).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, databaseForVariant } from '../lib/db';
import { retrieveForQuestion } from '../lib/retrieval';
import { rerankCandidates } from '../lib/rerank';

type DevQ = {
  id: string;
  kind: string;
  query: string;
  issueId?: string;
  hearingId?: string;
};

async function topScore(pool: ReturnType<typeof createPool>, q: DevQ): Promise<number> {
  const prevReject = process.env.RAG_REJECTION_THRESHOLD;
  const prevRerank = process.env.RAG_RERANKER_ENABLED;
  process.env.RAG_RERANKER_ENABLED = '1';
  delete process.env.RAG_REJECTION_THRESHOLD;
  const { rows, excerpts } = await retrieveForQuestion(pool, 'stack', {
    kind: q.kind === 'finnes_ikke' ? 'finnes_ikke' : 'sak_chunk',
    query: q.query,
    issueId: q.issueId,
    hearingId: q.hearingId,
    k: 10,
  });
  if (q.kind === 'finnes_ikke') {
    if (prevReject) process.env.RAG_REJECTION_THRESHOLD = prevReject;
    if (prevRerank) process.env.RAG_RERANKER_ENABLED = prevRerank;
    return excerpts.length > 0 ? 1 : 0;
  }
  if (rows.length === 0) return 0;
  const { scores } = await rerankCandidates(
    q.query,
    rows.slice(0, 30).map((r) => ({
      id: `${r.documentId}:${r.chunkIndex}`,
      content: r.content,
      fusedScore: r.rank,
    })),
  );
  const max = scores.length ? Math.max(...scores) : 0;
  if (prevReject) process.env.RAG_REJECTION_THRESHOLD = prevReject;
  if (prevRerank) process.env.RAG_RERANKER_ENABLED = prevRerank;
  return max;
}

async function main(): Promise<void> {
  const path =
    process.env.RAG_EVAL_DATASET === 'v2'
      ? join(process.cwd(), 'evals/rag/datasets/v2/questions-v2-dev.json')
      : join(process.cwd(), 'evals/rag/questions-dev.json');
  const questions = (JSON.parse(readFileSync(path, 'utf8')) as DevQ[]).filter((q) => q.kind === 'finnes_ikke' || q.kind === 'sak_chunk');
  const pool = createPool(databaseForVariant('stack'));
  const positives = questions.filter((q) => q.kind !== 'finnes_ikke');
  const negatives = questions.filter((q) => q.kind === 'finnes_ikke');

  const posScores: number[] = [];
  for (const q of positives) posScores.push(await topScore(pool, q));
  const negScores: number[] = [];
  for (const q of negatives) negScores.push(await topScore(pool, q));
  await pool.end();

  posScores.sort((a, b) => a - b);
  negScores.sort((a, b) => a - b);

  let bestT = 0.22;
  let bestReject = 0;
  const negBinary = negScores.every((s) => s === 0 || s === 1);
  if (negBinary && negatives.length > 0) {
    const rejectRate = negScores.filter((s) => s === 0).length / negatives.length;
    bestReject = rejectRate;
    bestT = 0.22;
  } else {
    for (let t = 0.05; t <= 0.95; t += 0.01) {
      const reject = negScores.filter((s) => s < t).length / Math.max(negatives.length, 1);
      const keep = posScores.filter((s) => s >= t).length / Math.max(positives.length, 1);
      if (reject >= 0.8 && keep >= 0.75 && reject > bestReject) {
        bestReject = reject;
        bestT = t;
      }
    }
  }

  const outDir = join(process.cwd(), 'evals/rag/config');
  mkdirSync(outDir, { recursive: true });
  const configPath = join(outDir, 'rejection-threshold.json');
  writeFileSync(
    configPath,
    JSON.stringify({ threshold: bestT, calibratedAt: new Date().toISOString(), devRejectRate: bestReject }, null, 2),
  );
  console.log(`[calibrate] threshold=${bestT.toFixed(3)} dev reject=${(bestReject * 100).toFixed(1)}% → ${configPath}`);
  console.log(`Export: RAG_REJECTION_THRESHOLD=${bestT.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
