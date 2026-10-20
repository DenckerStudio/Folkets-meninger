import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type PerQ = {
  id: string;
  kind?: string;
  hit?: boolean;
  r5?: boolean;
  topicExcerptHit?: boolean;
  ids?: string[];
  titles?: string[];
  skipped?: boolean;
  confident?: boolean;
};

const label = process.argv[2] ?? 'round3-rerank-reject';
const path = join(process.cwd(), 'evals/rag/results', `${label}.json`);
const data = JSON.parse(readFileSync(path, 'utf8')) as {
  perQuestion: PerQ[];
  issueSearchHitRate?: number;
  prefixHitRate?: number;
};

const failures: PerQ[] = [];
for (const row of data.perQuestion ?? []) {
  if (row.skipped) continue;
  if (row.kind === 'issue_search' && row.hit === false) failures.push(row);
  else if (row.kind === 'finnes_ikke' && row.confident === true) failures.push(row);
  else if (row.r5 === false && row.kind !== 'issue_search' && row.kind !== 'finnes_ikke' && row.kind !== 'topic')
    failures.push(row);
  else if (row.topicExcerptHit === false) failures.push(row);
}

const top = failures.slice(0, 10);
const out = join(process.cwd(), 'evals/rag/results', `${label}-top-failures.json`);
writeFileSync(out, JSON.stringify({ label, failureCount: failures.length, top }, null, 2));
console.log(`[analyze] ${failures.length} failures → ${out}`);
for (const f of top) {
  console.log(`  - ${f.id} (${f.kind})`);
}
