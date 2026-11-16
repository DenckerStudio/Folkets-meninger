import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminNavItems } from '@/lib/admin/nav';
import { routes } from '@/lib/routes';

const nav = adminNavItems.find((item) => item.id === 'sak-avstemning');
assert.ok(nav, 'admin-nav har sak-avstemning');
assert.equal(nav?.href, routes.adminSak);

const pageSrc = readFileSync(join(process.cwd(), 'app/dashboard/admin/sak/page.tsx'), 'utf8');
assert.match(pageSrc, /listAdminSakPollIndex/);
assert.match(pageSrc, /routes\.adminSakPoll/);

console.log('lib/admin/sak-poll-index.test.ts: ok');