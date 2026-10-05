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
assert(/rpc\(rpcName, \{ p_poll_id: pollId \}\)/.test(serviceSrc), 'publish/archive RPC call');
assert(/return 'publish_poll'/.test(serviceSrc), 'publish_poll name');
assert(/return 'archive_poll'/.test(serviceSrc), 'archive_poll name');
assert(/rpc\('create_system_poll_draft'/.test(serviceSrc), 'draft RPC');
assert(/isPostgrestMissingRpcError/.test(serviceSrc), 'PGRST202 fallback helper');
assert(/never use ensure_stortinget_poll for drafts/.test(serviceSrc), 'no stortinget poll for drafts');
assert(/applyPollStatusViaRpc\(pollId, 'publish'\)/.test(publishFn), 'publish uses RPC helper');
assert(/applyPollStatusViaRpc\(pollId, 'archive'\)/.test(archiveFn), 'archive uses RPC helper');
assert(!/updatePollStatusRow/.test(publishFn), 'publish is not a direct row update');
assert(!/ensure_stortinget_poll/.test(publishFn), 'publish does not call ensure_stortinget_poll');
assert(!/ensure_stortinget_poll/.test(archiveFn), 'archive does not call ensure_stortinget_poll');

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
