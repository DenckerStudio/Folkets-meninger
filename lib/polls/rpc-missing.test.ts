import assert from 'node:assert/strict';
import { applyPollStatusViaRpc } from '@/lib/polls/service';
import { isPostgrestMissingRpcError } from '@/lib/polls/rpc-missing';

const productionPublish = {
  code: 'PGRST202',
  details:
    'Searched for the function public.publish_poll with parameter p_poll_id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
  hint: null,
  message: 'Could not find the function public.publish_poll(p_poll_id) in the schema cache',
};

const productionArchive = {
  code: 'PGRST202',
  details:
    'Searched for the function public.archive_poll with parameter p_poll_id or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.',
  hint: null,
  message: 'Could not find the function public.archive_poll(p_poll_id) in the schema cache',
};

assert.equal(isPostgrestMissingRpcError(productionPublish), true);
assert.equal(isPostgrestMissingRpcError(productionArchive), true);
assert.equal(isPostgrestMissingRpcError(new Error('Poll is not a draft')), false);
assert.equal(
  isPostgrestMissingRpcError({ code: 'PGRST116', message: 'JSON object requested' }),
  false,
);
assert.equal(
  isPostgrestMissingRpcError({
    code: 'PGRST202',
    message: 'Could not find the function public.foo in the schema cache',
  }),
  true,
);

const pollId = '00000000-0000-4000-8000-000000000099';
let rpcCalls = 0;
let updateCalls = 0;

const service = {
  async rpc(name: string, _args: { p_poll_id: string }) {
    rpcCalls += 1;
    assert.equal(name, 'publish_poll');
    return { data: null, error: productionPublish };
  },
  from(table: string) {
    assert.equal(table, 'polls');
    return {
      select(_columns: string) {
        return {
          eq(_column: string, id: string) {
            assert.equal(id, pollId);
            return {
              async maybeSingle() {
                return {
                  data: { id: pollId, status: 'draft', opens_at: null },
                  error: null,
                };
              },
            };
          },
        };
      },
      update(patch: { status: string }) {
        updateCalls += 1;
        assert.equal(patch.status, 'open');
        return {
          eq(_column: string, id: string) {
            assert.equal(id, pollId);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
  },
};

async function main() {
  const publishedId = await applyPollStatusViaRpc(pollId, 'publish', service);
  assert.equal(publishedId, pollId);
  assert.equal(rpcCalls, 1);
  assert.equal(updateCalls, 1);
  console.log('poll rpc-missing tests OK');
}

void main();
