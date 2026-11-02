import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pageSrc = readFileSync(join(process.cwd(), 'app/del/[id]/page.tsx'), 'utf8');
const retiredSrc = readFileSync(
  join(process.cwd(), 'components/polls/share-poll-retired.tsx'),
  'utf8',
);

assert.match(pageSrc, /resolvePublicPollSharePage/);
assert.match(pageSrc, /SharePollRetiredPage/);
assert.match(pageSrc, /buildRetiredDelSharePageMetadata/);

assert.match(retiredSrc, /PollRetiredNotice/);

console.log('polls/del-share-route.test.ts: ok');
