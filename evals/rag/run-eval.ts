import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPool, databaseForVariant, type EvalVariant } from './lib/db';
import { retrieveForQuestion } from './lib/retrieval';

type Question = {
  id: string;
  kind: string;
  query: string;
  issueId?: string;
  hearingId?: string;
  gold: {
    facts?: string[];
    issueIds?: string[];
    titleMustContain?: string[];
    documentKinds?: string[];
    optional?: boolean;
  };
  tags?: string[];
};

type RunLabel = 'baseline' | 'stack' | 'improved';

function loadQuestions(): Question[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'evals/rag/questions.json'), 'utf8')) as Question[];
}

function factHit(text: string, facts: string[]): boolean {
  const hay = text.toLowerCase();
  return facts.length > 0 && facts.every((f) => hay.includes(f.toLowerCase()));
}

function recallAtK(rows: { documentId: string; chunkIndex: number }[], goldFacts: string[], contents: string[], k: number): boolean {
  const top = rows.slice(0, k);
  const texts = top.map((r, i) => contents[i] ?? '');
  return goldFacts.length === 0 ? top.length > 0 : texts.some((t) => factHit(t, goldFacts));
}

function mrr(rows: string[], goldFacts: string[]): number {
  for (let i = 0; i < rows.length; i += 1) {
    if (goldFacts.length === 0) return i === 0 ? 1 : 0;
    if (factHit(rows[i], goldFacts)) return 1 / (i + 1);
  }
  return 0;
}

async function issueSearch(
  pool: ReturnType<typeof createPool>,
  variant: EvalVariant,
  query: string,
  label: RunLabel,
): Promise<{ ids: string[]; titles: string[] }> {
  const ilike = async () => {
    const pattern = `%${query.slice(0, 80)}%`;
    const { rows } = await pool.query(
      `SELECT id, title FROM stortinget_issues
       WHERE title ILIKE $1 OR summary ILIKE $1 OR henvisning ILIKE $1
       ORDER BY last_synced_at DESC NULLS LAST LIMIT 8`,
      [pattern],
    );
    return { ids: rows.map((r) => String(r.id)), titles: rows.map((r) => String(r.title ?? '')) };
  };

  if (variant === 'baseline') return ilike();

  const { rows } = await pool.query(`SELECT * FROM search_issues_fts($1, NULL::text[], 8)`, [query]);
  const fts = {
    ids: rows.map((r) => String(r.id)),
    titles: rows.map((r) => String(r.title ?? '')),
  };
  if (label === 'improved' && fts.ids.length === 0) return ilike();
  return fts;
}

async function runLabel(label: RunLabel, variant: EvalVariant): Promise<Record<string, unknown>> {
  const pool = createPool(databaseForVariant(variant));
  const questions = loadQuestions();
  const latencies: number[] = [];
  let recall5 = 0;
  let recall10 = 0;
  let mrrSum = 0;
  let excerptHits = 0;
  let chunkEval = 0;
  let falseConfidence = 0;
  let finnesIkke = 0;
  let issueSearchHits = 0;
  let issueSearchTotal = 0;
  let prefixHits = 0;
  let prefixTotal = 0;
  let topicTotal = 0;
  let topicExcerptHits = 0;
  let topicFairSakCoverage = 0;
  const perQuestion: Record<string, unknown>[] = [];
  const useLegacyExcerptBug = false;

  for (const q of questions) {
    if (q.kind === 'issue_search') {
      issueSearchTotal += 1;
      const { ids, titles } = await issueSearch(pool, variant, q.query, label);
      const expectedIds = q.gold.issueIds ?? [];
      const titleNeedles = q.gold.titleMustContain ?? [];
      const hit =
        (expectedIds.length > 0 && expectedIds.some((id) => ids.includes(id))) ||
        (titleNeedles.length > 0 && titles.some((t) => titleNeedles.some((n) => t.toLowerCase().includes(n.toLowerCase())))) ||
        (expectedIds.length === 0 && titleNeedles.length === 0 && ids.length > 0);
      if (hit) issueSearchHits += 1;
      if (q.tags?.includes('prefix')) {
        prefixTotal += 1;
        if (hit) prefixHits += 1;
      }
      perQuestion.push({ id: q.id, kind: q.kind, hit, ids, titles });
      continue;
    }

    const isHearingTopic = q.kind === 'topic' && q.tags?.includes('hearing');
    const { rows, excerpts, topicBySak, ms } = await retrieveForQuestion(pool, variant, {
      kind: isHearingTopic ? 'hearing_topic' : q.kind,
      query: q.query,
      issueId: q.issueId,
      hearingId: q.hearingId,
      issueIds: q.gold.issueIds,
      k: 10,
      useLegacyExcerptBug,
    });
    latencies.push(ms);

    const facts = q.gold.facts ?? [];
    const contents = rows.map((r) => r.content);

    if (q.kind === 'finnes_ikke') {
      finnesIkke += 1;
      const confident = excerpts.length > 0;
      if (confident) falseConfidence += 1;
      perQuestion.push({ id: q.id, kind: q.kind, excerpts: excerpts.length, confident });
      continue;
    }

    if (q.gold.optional) {
      perQuestion.push({ id: q.id, skipped: true });
      continue;
    }

    if (q.kind === 'topic') {
      if (variant !== 'stack') {
        perQuestion.push({ id: q.id, skipped: true, reason: 'topic_stack_only' });
        continue;
      }
      topicTotal += 1;
      const excerptText = excerpts.map((e) => e.content).join(' ');
      const hit = factHit(excerptText, facts);
      if (hit) topicExcerptHits += 1;
      const expectedSaker = q.gold.issueIds ?? [];
      const covered = expectedSaker.filter((_, idx) => {
        const sakExcerpts = topicBySak?.[idx] ?? [];
        const text = sakExcerpts.map((e) => e.content).join(' ');
        return facts.some((f) => text.toLowerCase().includes(f.toLowerCase()));
      }).length;
      const fair = expectedSaker.length > 0 ? covered / expectedSaker.length : 0;
      topicFairSakCoverage += fair;
      perQuestion.push({
        id: q.id,
        topicExcerptHit: hit,
        topicFairSakCoverage: fair,
        sakerWithExcerpts: topicBySak?.map((s) => s.length) ?? [],
      });
      continue;
    }

    chunkEval += 1;
    const r5 = recallAtK(rows, facts, contents, 5);
    const r10 = recallAtK(rows, facts, contents, 10);
    if (r5) recall5 += 1;
    if (r10) recall10 += 1;
    mrrSum += mrr(contents, facts);
    const excerptText = excerpts.map((e) => e.content).join(' ');
    if (facts.length === 0 || factHit(excerptText, facts)) excerptHits += 1;
    perQuestion.push({
      id: q.id,
      r5,
      r10,
      excerptHit: facts.length === 0 || factHit(excerptText, facts),
      topRank: rows[0]?.rank ?? null,
    });
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  await pool.end();

  return {
    label,
    variant,
    stackHeads: {
      p177: 'a38d83d',
      p178: 'a2abc31',
      p179: '4c17c84',
      p181: '1e06816',
    },
    chunkQuestions: chunkEval,
    recallAt5: chunkEval ? recall5 / chunkEval : 0,
    recallAt10: chunkEval ? recall10 / chunkEval : 0,
    mrr: chunkEval ? mrrSum / chunkEval : 0,
    excerptFactRate: chunkEval ? excerptHits / chunkEval : 0,
    topicQuestions: topicTotal,
    topicExcerptFactRate: topicTotal ? topicExcerptHits / topicTotal : 0,
    topicFairSakCoverage: topicTotal ? topicFairSakCoverage / topicTotal : 0,
    issueSearchHitRate: issueSearchTotal ? issueSearchHits / issueSearchTotal : 0,
    prefixHitRate: prefixTotal ? prefixHits / prefixTotal : 0,
    finnesIkkeFalseConfidenceRate: finnesIkke ? falseConfidence / finnesIkke : 0,
    latencyMsP50: p50,
    latencyMsP95: p95,
    judge: process.env.JUDGE_URL ? 'configured' : 'pending (LAN)',
    perQuestion,
  };
}

async function main(): Promise<void> {
  const mode = process.env.RAG_EVAL_RUN ?? 'all';
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });

  const runs: RunLabel[] =
    mode === 'baseline'
      ? ['baseline']
      : mode === 'stack'
        ? ['stack']
        : mode === 'improved'
          ? ['improved']
          : ['baseline', 'stack', 'improved'];

  const summary: Record<string, unknown>[] = [];
  for (const label of runs) {
    const variant: EvalVariant = label === 'baseline' ? 'baseline' : 'stack';
    if (label === 'improved') {
      const tuning = join(process.cwd(), 'evals/rag/sql/tuning-pr179-rrf-k40.sql');
      execSync(
        `psql -h localhost -U rag_eval -d rag_eval_stack -v ON_ERROR_STOP=1 -q -f ${JSON.stringify(tuning)}`,
        { env: { ...process.env, PGPASSWORD: 'rag_eval' }, stdio: 'inherit' },
      );
    }
    console.log(`[eval] running ${label}…`);
    const result = await runLabel(label, variant);
    summary.push(result);
    writeFileSync(join(outDir, `${label}.json`), JSON.stringify(result, null, 2));
  }

  const md = [
    '| Run | R@5 | R@10 | MRR | Excerpt hit | Topic excerpt | Topic fair sak | Issue search | Prefix | Finnes-ikke FP | p50 | p95 | Judge |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...summary.map((r) => {
      const row = r as Record<string, number | string>;
      return `| ${row.label} | ${(Number(row.recallAt5) * 100).toFixed(1)}% | ${(Number(row.recallAt10) * 100).toFixed(1)}% | ${Number(row.mrr).toFixed(3)} | ${(Number(row.excerptFactRate) * 100).toFixed(1)}% | ${(Number(row.topicExcerptFactRate) * 100).toFixed(1)}% | ${(Number(row.topicFairSakCoverage) * 100).toFixed(1)}% | ${(Number(row.issueSearchHitRate) * 100).toFixed(1)}% | ${(Number(row.prefixHitRate) * 100).toFixed(1)}% | ${(Number(row.finnesIkkeFalseConfidenceRate) * 100).toFixed(1)}% | ${Number(row.latencyMsP50).toFixed(0)} | ${Number(row.latencyMsP95).toFixed(0)} | ${row.judge} |`;
    }),
  ].join('\n');

  writeFileSync(join(outDir, 'summary.md'), `${md}\n`);
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
