import { readFileSync } from 'node:fs';
import { isPostgrestMissingRpcError } from '@/lib/polls/rpc-missing';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const serviceSrc = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const publishFn =
  serviceSrc.match(/export async function publishPoll\([\s\S]*?\n\}/)?.[0] ?? '';
const archiveFn =
  serviceSrc.match(/export async function archivePoll\([\s\S]*?\n\}/)?.[0] ?? '';
assert.match(serviceSrc, /rpc\(rpcName, \{ p_poll_id: pollId \}\)/);
assert.match(serviceSrc, /return 'publish_poll'/);
assert.match(serviceSrc, /return 'archive_poll'/);
assert.match(serviceSrc, /rpc\('create_system_poll_draft'/);
assert.match(serviceSrc, /isPostgrestMissingRpcError/);
assert.match(serviceSrc, /never use ensure_stortinget_poll for drafts/);
assert.match(publishFn, /applyPollStatusViaRpc\(pollId, 'publish'\)/);
assert.match(archiveFn, /applyPollStatusViaRpc\(pollId, 'archive'\)/);
assert.doesNotMatch(publishFn, /updatePollStatusRow/);
assert.doesNotMatch(publishFn, /ensure_stortinget_poll/);
assert.doesNotMatch(archiveFn, /ensure_stortinget_poll/);

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
