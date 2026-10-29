import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

const commentSrc = read('app/dashboard/horinger/[id]/comment-form.tsx');
const exploreSrc = read('app/dashboard/utforsk/explore-client.tsx');

const submitFn = commentSrc.match(
  /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};/,
)?.[0];
assert.ok(submitFn, 'comment form must define handleSubmit');
assert.match(submitFn, /await fetch\('\/api\/hearings'/);
assert.match(
  submitFn,
  /try\s*\{[\s\S]*await fetch\('\/api\/hearings'[\s\S]*\}\s*catch[\s\S]*\}\s*finally/,
);
assert.match(submitFn, /finally\s*\{[\s\S]*setSubmitting\(false\)/);
assert.match(
  submitFn,
  /catch\s*\{[\s\S]*setError\('Kunne ikke publisere innspillet\. Prøv igjen\.'\)/,
);
assert.match(
  submitFn,
  /if\s*\(!res\.ok\)\s*\{[\s\S]*setError\(data\.error \|\| 'Kunne ikke publisere innspillet\. Prøv igjen\.'\)/,
);

const sortStart = exploreSrc.indexOf('aria-label="Sorter saker"');
assert.ok(sortStart >= 0, 'utforsk must label the sort control group');
const sortBlock = exploreSrc.slice(Math.max(0, sortStart - 80), sortStart + 900);
assert.match(sortBlock, /role="group"/);
assert.match(sortBlock, /aria-pressed=\{selected\}/);
assert.doesNotMatch(sortBlock, /role="tab"/);
assert.doesNotMatch(sortBlock, /role="tablist"/);
assert.doesNotMatch(sortBlock, /aria-selected=/);

console.log('dashboard/interaction-resilience.test.ts: ok');
