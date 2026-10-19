import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSearchTerms } from '@/lib/chat/sak-search';
import { createPool, databaseForVariant, type EvalVariant } from './lib/db';
import { retrieveForQuestion } from './lib/retrieval';
import { scorePartyPositionsInText, type PartyStance } from './lib/v2-party-score';
import { v2QuestionsPath } from './lib/v2-paths';

const CATEGORIES = [
  'eksakt_sak',
  'tema',
  'prefiks_delord',
  'sammensatte_ord',
  'voteringer_parti',
  'horinger',
  'finnes_ikke',
] as const;

type V2Question = {
  id: string;
  kind: string;
  category: string;
  query: string;
  issueId?: string;
  hearingId?: string;
  gold: {
    facts?: string[];
    issueIds?: string[];
    titleMustContain?: string[];
    partyPositions?: Record<string, PartyStance>;
    askedParties?: string[];
    optional?: boolean;
  };
  tags?: string[];
};

function loadQuestions(split: 'dev' | 'test'): V2Question[] {
  return JSON.parse(readFileSync(v2QuestionsPath(split), 'utf8')) as V2Question[];
}

function factHit(text: string, facts: string[]): boolean {
  const hay = text.toLowerCase();
  return facts.length > 0 && facts.every((f) => hay.includes(f.toLowerCase()));
}

function recallAtK(rows: { content: string }[], goldFacts: string[], k: number): boolean {
  const top = rows.slice(0, k).map((r) => r.content);
  return goldFacts.length === 0 ? top.length > 0 : top.some((t) => factHit(t, goldFacts));
}

async function issueSearch(
  pool: ReturnType<typeof createPool>,
  query: string,
): Promise<{ ids: string[]; titles: string[] }> {
  const terms = buildSearchTerms(query);
  const { rows } = await pool.query(`SELECT * FROM search_issues_fts($1, $2::text[], 8)`, [query, terms]);
  return {
    ids: rows.map((r) => String(r.id)),
    titles: rows.map((r) => String(r.title ?? '')),
  };
}

function issueSearchHit(q: V2Question, ids: string[], titles: string[]): boolean {
  const expectedIds = (q.gold.issueIds ?? []).map(String);
  const titleNeedles = q.gold.titleMustContain ?? [];
  const idHit = expectedIds.length > 0 && expectedIds.some((id) => ids.includes(id));
  const titleHit =
    titleNeedles.length > 0 &&
    titles.some((t) => titleNeedles.some((n) => t.toLowerCase().includes(n.toLowerCase())));
  if (expectedIds.length > 0 && titleNeedles.length > 0) return idHit && titleHit;
  if (expectedIds.length > 0) return idHit;
  if (titleNeedles.length > 0) return titleHit;
  return ids.length > 0;
}

async function loadTitleCorpus(pool: ReturnType<typeof createPool>): Promise<string> {
  const { rows: issues } = await pool.query<{ title: string; summary: string }>(
    `SELECT title, summary FROM stortinget_issues`,
  );
  const { rows: hearings } = await pool.query<{ tittel: string }>(`SELECT tittel FROM stortinget_hearings`);
  return [...issues.map((r) => `${r.title} ${r.summary}`), ...hearings.map((r) => r.tittel)].join('\n').toLowerCase();
}

async function loadFullTextCorpus(pool: ReturnType<typeof createPool>): Promise<string> {
  const { rows } = await pool.query<{ content: string }>(
    `SELECT content FROM document_chunks ORDER BY issue_id NULLS LAST LIMIT 8000`,
  );
  return rows.map((r) => r.content).join('\n').toLowerCase();
}

function finnesIkkeDistinctTerms(facts: string[]): string[] {
  return facts.map((f) => f.toLowerCase()).filter((f) => f.length >= 5);
}

function termsHitCorpus(terms: string[], corpus: string): boolean {
  return terms.length > 0 && terms.every((t) => corpus.includes(t));
}

export async function runEvalV2(split: 'dev' | 'test', variant: EvalVariant = 'stack'): Promise<Record<string, unknown>> {
  const metaPath = join(process.cwd(), 'evals/rag/corpus-meta.json');
  const seedCounts = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, 'utf8')) as Record<string, unknown>)
    : {};
  const excludedHearings = new Set(
    ((seedCounts.excludedHearings as Array<{ id: string }>) ?? []).map((e) => e.id),
  );

  const pool = createPool(databaseForVariant(variant));
  const questions = loadQuestions(split).filter((q) => !q.hearingId || !excludedHearings.has(q.hearingId));
  const titleCorpus = await loadTitleCorpus(pool);
  const fullTextCorpus = await loadFullTextCorpus(pool);

  const latencies: number[] = [];
  let chunkEval = 0;
  let recall5 = 0;
  let partyEval = 0;
  let partyHits = 0;
  let finnesIkke = 0;
  let finnesIkkeCorrect = 0;
  const finnesIkkeFullTextHits: Array<{ id: string; terms: string[] }> = [];

  const catStats: Record<string, { n: number; hit: number }> = {};
  for (const c of CATEGORIES) catStats[c] = { n: 0, hit: 0 };

  const perQuestion: Record<string, unknown>[] = [];

  for (const q of questions) {
    const cat = q.category;
    if (!catStats[cat]) catStats[cat] = { n: 0, hit: 0 };

    if (q.kind === 'issue_search') {
      catStats[cat].n += 1;
      const { ids, titles } = await issueSearch(pool, q.query);
      const hit = issueSearchHit(q, ids, titles);
      if (hit) catStats[cat].hit += 1;
      perQuestion.push({ id: q.id, category: cat, kind: q.kind, hit, ids, titles });
      continue;
    }

    const start = performance.now();
    const isHearingTopic = q.kind === 'topic' && q.tags?.includes('hearing');
    const { rows, excerpts } = await retrieveForQuestion(pool, variant, {
      kind: isHearingTopic ? 'hearing_topic' : q.kind,
      query: q.query,
      issueId: q.issueId,
      hearingId: q.hearingId,
      issueIds: q.gold.issueIds,
      k: 10,
    });
    latencies.push(performance.now() - start);

    if (q.kind === 'finnes_ikke') {
      finnesIkke += 1;
      catStats[cat].n += 1;
      const confident = excerpts.length > 0;
      const correct = !confident;
      if (correct) {
        catStats[cat].hit += 1;
        finnesIkkeCorrect += 1;
      }
      const terms = finnesIkkeDistinctTerms(q.gold.facts ?? []);
      const titleWouldMatch = termsHitCorpus(terms, titleCorpus);
      const fullTextMatch = termsHitCorpus(terms, fullTextCorpus);
      if (!correct && fullTextMatch && !titleWouldMatch) {
        finnesIkkeFullTextHits.push({ id: q.id, terms });
      }
      perQuestion.push({
        id: q.id,
        category: cat,
        confident,
        titleWouldMatch,
        fullTextMatch,
        note: 'finnes_ikke scored on retrieval rejection; GT validated titles only',
      });
      continue;
    }

    if (q.category === 'voteringer_parti' && q.gold.partyPositions && q.gold.askedParties) {
      partyEval += 1;
      catStats[cat].n += 1;
      const text = rows.map((r) => r.content).join('\n');
      const partyHit = scorePartyPositionsInText(text, q.gold.partyPositions, q.gold.askedParties);
      if (partyHit) {
        partyHits += 1;
        catStats[cat].hit += 1;
      }
      const r5 = recallAtK(rows, q.gold.facts ?? [], 5);
      chunkEval += 1;
      if (r5) recall5 += 1;
      perQuestion.push({ id: q.id, category: cat, partyHit, r5 });
      continue;
    }

    if (q.kind === 'topic') {
      catStats[cat].n += 1;
      const excerptText = excerpts.map((e) => e.content).join(' ');
      const hit = factHit(excerptText, q.gold.facts ?? []);
      if (hit) catStats[cat].hit += 1;
      perQuestion.push({ id: q.id, category: cat, topicExcerptHit: hit });
      continue;
    }

    if (q.kind === 'sak_chunk' || q.kind === 'hearing_chunk') {
      chunkEval += 1;
      catStats[cat].n += 1;
      const r5 = recallAtK(rows, q.gold.facts ?? [], 5);
      if (r5) {
        recall5 += 1;
        catStats[cat].hit += 1;
      }
      perQuestion.push({ id: q.id, category: cat, r5 });
    }
  }

  await pool.end();
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;

  const prefixStat = catStats.prefiks_delord;
  const byCategory: Record<string, { n: number; rate: number }> = {};
  for (const c of CATEGORIES) {
    const s = catStats[c];
    byCategory[c] = { n: s.n, rate: s.n ? s.hit / s.n : 0 };
  }

  return {
    dataset: 'v2',
    split,
    variant,
    seedCounts,
    excludedQuestionHearings: [...excludedHearings],
    recallAt5: chunkEval ? recall5 / chunkEval : 0,
    chunkQuestions: chunkEval,
    partyHitRate: partyEval ? partyHits / partyEval : 0,
    partyQuestions: partyEval,
    prefixHitRate: prefixStat.n ? prefixStat.hit / prefixStat.n : 0,
    finnesIkkeCorrectRejectionRate: finnesIkke ? finnesIkkeCorrect / finnesIkke : 0,
    finnesIkkeFullTextHits,
    finnesIkkeNotes:
      'finnes_ikke GT checks titles/korttitler only; fullTextMatch flags corpus hits not reflected in title-only GT',
    byCategory,
    latencyMsP95: p95,
    perQuestion,
  };
}

async function main(): Promise<void> {
  const split = (process.env.RAG_EVAL_SPLIT ?? 'test') as 'dev' | 'test';
  const label = process.env.RAG_EVAL_LABEL ?? `v2-${split}-stack`;
  const outDir = join(process.cwd(), 'evals/rag/results');
  mkdirSync(outDir, { recursive: true });
  const result = await runEvalV2(split, 'stack');
  writeFileSync(join(outDir, `${label}.json`), JSON.stringify(result, null, 2));

  const md = [
    `# RAG eval v2 (${split})`,
    '',
    '| Category | n | rate |',
    '| --- | ---: | ---: |',
    ...CATEGORIES.map((c) => {
      const row = (result.byCategory as Record<string, { n: number; rate: number }>)[c];
      return `| ${c} | ${row.n} | ${(row.rate * 100).toFixed(1)}% |`;
    }),
    '',
    `**Sak R@5 (chunk):** ${(Number(result.recallAt5) * 100).toFixed(1)}% (n=${result.chunkQuestions})`,
    `**Prefix (prefiks_delord):** ${(Number(result.prefixHitRate) * 100).toFixed(1)}%`,
    `**Finnes-ikke reject:** ${(Number(result.finnesIkkeCorrectRejectionRate) * 100).toFixed(1)}%`,
    `**p95:** ${Number(result.latencyMsP95).toFixed(0)} ms`,
    '',
    result.finnesIkkeFullTextHits && (result.finnesIkkeFullTextHits as unknown[]).length > 0
      ? `**finnes_ikke full-text hits (not title GT):** ${JSON.stringify(result.finnesIkkeFullTextHits)}`
      : '',
  ].join('\n');
  writeFileSync(join(outDir, `${label}.md`), `${md}\n`);
  console.log(md);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
