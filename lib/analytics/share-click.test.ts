import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldRecordShareClick } from '@/lib/analytics/share-click';

const allowed = { ok: true as const, remaining: 1 };
const limited = { ok: false as const, retryAfterSeconds: 30 };

assert.equal(shouldRecordShareClick(allowed, allowed), true);
assert.equal(shouldRecordShareClick(limited, allowed), false);
assert.equal(shouldRecordShareClick(allowed, limited), false);
assert.equal(shouldRecordShareClick(limited, limited), false);

const route = readFileSync(join(process.cwd(), 'app/l/[code]/route.ts'), 'utf8');
assert.match(route, /checkRateLimit/);
assert.match(route, /share-click:ip:/);
assert.match(route, /share-click:code:/);
assert.match(route, /shouldRecordShareClick/);
assert.match(route, /NextResponse\.redirect/);
assert.doesNotMatch(route, /status:\s*429/);

console.log('lib/analytics/share-click.test.ts ok');
