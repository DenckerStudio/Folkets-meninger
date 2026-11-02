import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'lib/polls/retired-system.ts'), 'utf8');

assert.match(src, /isRetiredSystemSharePoll\(publicPoll\)/);
assert.match(src, /isShareablePoll\(publicPoll\)/);

console.log('retired-system.test.ts: ok');
