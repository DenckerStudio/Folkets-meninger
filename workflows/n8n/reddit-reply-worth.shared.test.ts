import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPLY_REPLY_WORTH_GATE_JS,
  REPLY_WORTH_SYSTEM_MESSAGE,
} from '@/workflows/n8n/reddit-reply-worth.shared';
import { REPLY_WORTH_TITLE_BLOCKLIST } from '@/lib/reddit-signals/reply-worth-gate';

assert.match(REPLY_WORTH_SYSTEM_MESSAGE, /worth/);
assert.match(REPLY_WORTH_SYSTEM_MESSAGE, /bokmål/i);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /MAX_AGE_HOURS = 72/);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /MIN_COMMENTS = 3/);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /MAX_COMMENTS = 150/);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /MIN_SCORE = 5/);

// Blocklist tokens present in both TS gate and n8n JS.
assert.match(APPLY_REPLY_WORTH_GATE_JS, /meme/);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /shopping/);
assert.match(APPLY_REPLY_WORTH_GATE_JS, /giveaway/);
assert.ok(APPLY_REPLY_WORTH_GATE_JS.includes('hvilken\\s+bank'));
assert.match(REPLY_WORTH_TITLE_BLOCKLIST.source, /meme/);
assert.match(REPLY_WORTH_TITLE_BLOCKLIST.source, /shopping/);

const workflowSrc = readFileSync(
  join(process.cwd(), 'workflows/n8n/reddit-reply-worth.workflow.ts'),
  'utf-8',
);
assert.match(workflowSrc, /n8n_list_reddit_reply_worth_candidates/);
assert.match(workflowSrc, /n8n_set_reddit_reply_worth/);
assert.match(workflowSrc, /gemma4:26b/);
assert.doesNotMatch(workflowSrc, /\bselftext\b/i);

console.log('workflows/n8n/reddit-reply-worth.shared.test.ts: ok');
