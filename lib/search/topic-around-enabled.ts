import { getChatRagRpcClient } from '@/lib/chat/rag-rpc-client';

/** When unset/false, «Søk rundt temaet» is hidden and APIs return disabled. */
export function isTopicAroundSearchEnabled(): boolean {
  const raw = process.env.TOPIC_AROUND_SEARCH_ENABLED?.trim().toLowerCase() ?? '';
  if (raw !== '1' && raw !== 'true' && raw !== 'yes') {
    return false;
  }
  if (!(process.env.EMBED_QUERY_URL ?? '').trim()) {
    return false;
  }
  return Boolean(getChatRagRpcClient()?.rpc);
}