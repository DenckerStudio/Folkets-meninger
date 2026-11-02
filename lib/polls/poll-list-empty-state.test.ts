import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'components/polls/poll-list-empty-state.tsx'),
  'utf8',
);

assert.match(src, /EmptyState/);
assert.match(src, /POLL_LIST_EMPTY_SHELL_CLASS/);
assert.match(src, /min-h-\[320px\]/);
assert.match(src, /VURDER_FOCUS_RING/);
assert.match(src, /min-h-11/);
assert.match(src, /routes\.utforsk/);
assert.match(src, /text-muted-foreground/);

console.log('lib/polls/poll-list-empty-state.test.ts: ok');
