import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isResearchApiAction, RESEARCH_API_ACTIONS } from '@/lib/admin/research/actions';
import { signResearchWebhookPayload } from '@/lib/admin/research/webhook';

const actionRoute = readFileSync(
  join(process.cwd(), 'app/api/admin/research/[clusterId]/[action]/route.ts'),
  'utf-8',
);
const feedbackRoute = readFileSync(
  join(process.cwd(), 'app/api/admin/research/feedback/route.ts'),
  'utf-8',
);

assert.match(actionRoute, /requireAdmin\(\)/);
assert.match(actionRoute, /isResearchApiAction\(action\)/);
assert.match(actionRoute, /status: 502/);
assert.match(feedbackRoute, /requireAdmin\(\)/);

assert.deepEqual(RESEARCH_API_ACTIONS, ['deepen', 'blog', 'reel']);
assert.equal(isResearchApiAction('deepen'), true);
assert.equal(isResearchApiAction('invalid'), false);

const sigA = signResearchWebhookPayload('secret', '1', '{"x":1}');
const sigB = signResearchWebhookPayload('secret', '2', '{"x":1}');
assert.notEqual(sigA, sigB);

console.log('admin/research/api-route.test.ts: ok');
