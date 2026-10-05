import { isPostgrestMissingRpcError } from '@/lib/polls/rpc-missing';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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

assert(isPostgrestMissingRpcError(productionPublish), 'publish PGRST202');
assert(isPostgrestMissingRpcError(productionArchive), 'archive PGRST202');
assert(!isPostgrestMissingRpcError(new Error('Poll is not a draft')), 'business error');
assert(!isPostgrestMissingRpcError({ code: 'PGRST116', message: 'JSON object requested' }), 'other postgrest');

console.log('poll rpc-missing tests OK');
