import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pageSource = readFileSync(
  join(process.cwd(), 'app/dashboard/representanter/page.tsx'),
  'utf8',
);

assert.match(
  pageSource,
  /import\s+\{\s*getRepresentanterForPeriode\s*\}\s+from\s+['"]@\/lib\/stortinget['"]/,
);
assert.match(
  pageSource,
  /getRepresentanterForPeriode\(\s*STORTINGET_ACTIVE_PERIODE_ID\s*\)/,
);
assert.doesNotMatch(pageSource, /from\s+['"]next\/headers['"]/);
assert.doesNotMatch(pageSource, /x-forwarded-(?:host|proto)/);
assert.doesNotMatch(pageSource, /\/api\/representanter/);

console.log('dashboard/representanter-page.test.ts: ok');
