import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiRoute = readFileSync(join(process.cwd(), 'app/api/polls/route.ts'), 'utf8');
const sitemap = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8');

assert.match(apiRoute, /isPublicAvstemningTrack/);
assert.match(apiRoute, /listOpenPolls/);
assert.match(apiRoute, /!isPublicAvstemningTrack\(poll\.track\)/);

assert.doesNotMatch(sitemap, /listOpenPolls/);
assert.doesNotMatch(sitemap, /\/dashboard\/avstemninger\/\$\{/);

console.log('lib/sitemap/poll-routes.test.ts: ok');
