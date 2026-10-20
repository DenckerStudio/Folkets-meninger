import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOppfangetAdminPath } from '@/lib/admin/oppfanget/query';
import { routes } from '@/lib/routes';

const apiRoute = readFileSync(
  join(process.cwd(), 'app/api/admin/oppfanget/route.ts'),
  'utf-8',
);
const researchPage = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/research/page.tsx'),
  'utf-8',
);
const legacyRedirect = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/oppfanget/page.tsx'),
  'utf-8',
);
const nextConfig = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf-8');
const adminLayout = readFileSync(
  join(process.cwd(), 'app/dashboard/admin/layout.tsx'),
  'utf-8',
);

assert.match(researchPage, /await requireAdminPage\(routes\.adminResearch\)/);
assert.match(legacyRedirect, /permanentRedirect\(/);
assert.match(legacyRedirect, /routes\.adminResearch/);
assert.match(nextConfig, /\/dashboard\/admin\/oppfanget/);
assert.match(nextConfig, /\/dashboard\/admin\/research/);
assert.match(nextConfig, /permanent:\s*true/);

const legacyPath = buildOppfangetAdminPath({ q: 'test', status: 'oppfanget' }, 'mock');
assert.equal(legacyPath.startsWith('/dashboard/admin/research?'), true);
const legacyQs = new URLSearchParams(legacyPath.split('?')[1] ?? '');
assert.equal(legacyQs.get('q'), 'test');
assert.equal(legacyQs.get('status'), 'oppfanget');
assert.equal(legacyQs.get('preview'), 'mock');
assert.match(apiRoute, /requireAdmin\(\)/);
assert.match(apiRoute, /status: auth\.status/);
assert.match(adminLayout, /requireAdminPage/);
assert.equal(routes.adminResearch, '/dashboard/admin/research');
assert.equal(routes.utforsk, '/dashboard/utforsk');

console.log('admin/oppfanget/access.test.ts: ok');
