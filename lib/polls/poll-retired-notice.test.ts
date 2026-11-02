import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const notice = readFileSync(
  join(process.cwd(), 'components/polls/poll-retired-notice.tsx'),
  'utf8',
);
const embed = readFileSync(join(process.cwd(), 'app/embed/[id]/page.tsx'), 'utf8');
const utforsk = readFileSync(join(process.cwd(), 'app/dashboard/utforsk/explore-client.tsx'), 'utf8');

assert.match(notice, /linkOpensInNewTab/);
assert.match(notice, /target="_blank"/);
assert.match(notice, /rel="noopener noreferrer"/);
assert.match(notice, /variant\?: 'default' \| 'bare'/);

assert.match(embed, /variant="bare"/);
assert.match(embed, /linkOpensInNewTab/);

assert.doesNotMatch(utforsk, /PollListEmptyState/);

console.log('poll-retired-notice.test.ts: ok');
