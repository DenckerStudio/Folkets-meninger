import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const listRoute = readFileSync(join(process.cwd(), 'app/api/user-annotations/route.ts'), 'utf-8');
const detailRoute = readFileSync(
  join(process.cwd(), 'app/api/user-annotations/[id]/route.ts'),
  'utf-8',
);

assert.match(listRoute, /requireAdmin\(\)/);
assert.match(listRoute, /isUserAnnotationCreatableTargetType/);
assert.match(listRoute, /flag_type/);

assert.match(detailRoute, /requireAdmin\(\)/);
assert.match(detailRoute, /flag_type/);

console.log('user-annotations/api-route.test.ts: ok');