import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'evals/rag');

for (const file of ['export-answers.ts', 'export-answers-v2.ts']) {
  const src = readFileSync(join(root, file), 'utf8');
  assert.ok(
    !src.includes('Basert på utdrag:'),
    `${file} must not concatenate excerpts as the answer (legacy stub)`,
  );
  assert.ok(
    !src.includes('.slice(0, 1200)'),
    `${file} must not hard-cap answers at 1200 chars of excerpt text`,
  );
  assert.ok(
    src.includes('generateRagAnswer'),
    `${file} must synthesize answers via generateRagAnswer`,
  );
  if (file === 'export-answers-v2.ts') {
    assert.ok(
      src.includes('issueIds: q.gold?.issueIds'),
      `${file} must pass gold issueIds for topic retrieval (eval parity)`,
    );
  }
}

console.log('export-answers.regression.test.ts: ok');
