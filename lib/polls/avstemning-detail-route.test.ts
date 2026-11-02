import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(
  join(process.cwd(), 'app/dashboard/avstemninger/[id]/page.tsx'),
  'utf8',
);
const embed = readFileSync(join(process.cwd(), 'app/embed/[id]/page.tsx'), 'utf8');

assert.match(page, /getRetiredSystemPollById/);
assert.match(page, /PollRetiredNotice/);
assert.match(page, /isPublicAvstemningTrack/);
assert.match(embed, /resolvePublicPollSharePage/);
assert.match(embed, /PollRetiredNotice/);
assert.match(embed, /linkOpensInNewTab/);
assert.match(embed, /variant="bare"/);

console.log('lib/polls/avstemning-detail-route.test.ts: ok');
