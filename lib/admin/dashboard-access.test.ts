import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/lib/routes';

const root = process.cwd();
const adminPagesDir = join(root, 'app/dashboard/admin');

function listAdminPageFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir)) {
    const full = join(dir, ent);
    if (statSync(full).isDirectory()) {
      listAdminPageFiles(full, acc);
    } else if (ent === 'page.tsx') {
      acc.push(full);
    }
  }
  return acc;
}

const adminPages = listAdminPageFiles(adminPagesDir).sort();

for (const absPath of adminPages) {
  const rel = absPath.slice(root.length + 1);
  const source = readFileSync(absPath, 'utf8');
  assert.match(
    source,
    /\bawait requireAdminPage\(/,
    `${rel} must call await requireAdminPage() before other server work`,
  );
}

const reelsPage = readFileSync(join(root, 'app/dashboard/admin/reels/page.tsx'), 'utf8');
const reelsRequireAt = reelsPage.indexOf('await requireAdminPage');
const reelsListAt = reelsPage.indexOf('await listSystemPollDrafts');
assert.ok(reelsRequireAt >= 0 && reelsRequireAt < reelsListAt);

const statsPage = readFileSync(join(root, 'app/dashboard/admin/statistikk/page.tsx'), 'utf8');
const statsRequireAt = statsPage.indexOf('await requireAdminPage');
const statsEnvAt = statsPage.indexOf('process.env.UMAMI_ADMIN_URL');
assert.ok(statsRequireAt >= 0 && statsRequireAt < statsEnvAt);

const middleware = readFileSync(join(root, 'middleware.ts'), 'utf8');
assert.match(middleware, /isAdminPath\(pathname\)/);
assert.match(middleware, /isMiddlewareUserAdmin\(supabase, user\.id\)/);
assert.match(middleware, /url\.pathname = routes\.utforsk/);

const meRoute = readFileSync(join(root, 'app/api/admin/me/route.ts'), 'utf8');
assert.match(meRoute, /status:\s*401/);
assert.match(meRoute, /\{ admin \}/);

const gate = readFileSync(join(root, 'lib/admin/gate.ts'), 'utf8');
assert.match(gate, /redirect\(routes\.utforsk\)/);

assert.equal(routes.utforsk, '/dashboard/utforsk');

console.log(
  `admin/dashboard-access.test.ts: ok (${adminPages.length} admin pages, middleware + /api/admin/me)`,
);