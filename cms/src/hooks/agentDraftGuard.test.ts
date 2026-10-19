import assert from 'node:assert/strict';
import type { PayloadRequest } from 'payload';
import { agentDraftGuard } from './agentDraftGuard';

function req(role: string): PayloadRequest {
  return { user: { id: 1, role } } as unknown as PayloadRequest;
}

const base = {
  title: 't',
  slug: 's',
  featured: true,
  publishedAt: '2026-01-01T00:00:00.000Z',
};

const run = (role: string, data: Record<string, unknown>) =>
  agentDraftGuard({
    data: { ...data },
    req: req(role),
    operation: 'create',
    collection: {} as never,
    context: {},
  });

const agentOut = run('agent', base) as Record<string, unknown>;
assert.equal(agentOut._status, 'draft');
assert.equal(agentOut.featured, false);
assert.equal(agentOut.publishedAt, undefined);

console.log('cms/src/hooks/agentDraftGuard.test.ts ok');
