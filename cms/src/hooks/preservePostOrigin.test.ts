import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import { POST_ORIGIN_CONTEXT_KEY, preservePostOrigin } from './preservePostOrigin';

function req(user: { role?: string } | null = null, context: Record<string, unknown> = {}) {
  return { user, context } as PayloadRequest;
}

const runHook = preservePostOrigin as (
  args: Parameters<typeof preservePostOrigin>[0],
) => Promise<Record<string, unknown>>;

assert.deepEqual(
  await runHook({
    data: { origin: 'n8n', _status: 'published' },
    req: req({ role: 'redaktor' }),
    operation: 'create',
    originalDoc: undefined,
    collection: {} as never,
    context: {},
  }),
  { origin: 'manual', _status: 'published' },
);

const agentReq = req({ role: 'agent' });
assert.deepEqual(
  await runHook({
    data: { origin: 'n8n' },
    req: agentReq,
    operation: 'create',
    originalDoc: undefined,
    collection: {} as never,
    context: {},
  }),
  { origin: 'n8n' },
);

const trustedReq = req(null);
trustedReq.context[POST_ORIGIN_CONTEXT_KEY] = 'n8n';
assert.deepEqual(
  await runHook({
    data: { origin: 'manual', _status: 'published' },
    req: trustedReq,
    operation: 'create',
    originalDoc: undefined,
    collection: {} as never,
    context: trustedReq.context,
  }),
  { origin: 'n8n', _status: 'published' },
);

console.log('cms/src/hooks/preservePostOrigin.test.ts ok');
