import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pageSrc = readFileSync(join(process.cwd(), 'app/del/[id]/page.tsx'), 'utf8');
const retiredSrc = readFileSync(
  join(process.cwd(), 'components/polls/share-poll-retired.tsx'),
  'utf8',
);

assert.match(pageSrc, /getSharePagePollById/);
assert.match(pageSrc, /isRetiredSystemSharePoll/);
assert.match(pageSrc, /SharePollRetiredPage/);
assert.match(pageSrc, /robots: \{ index: false/);
assert.doesNotMatch(pageSrc, /isRetiredSystemSharePoll\(poll\)\) notFound\(\)/);

assert.match(retiredSrc, /SYSTEM_POLL_SHARE_RETIRED_TITLE/);
assert.match(retiredSrc, /routes\.avstemninger/);

console.log('polls/del-share-route.test.ts: ok');
