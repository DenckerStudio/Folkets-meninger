import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabase';
import {
  normalizeForumVoteHistory,
  summarizeForumVoteHistory,
  topForumVoteTopics,
  type ForumVoteHistoryItem,
  type ForumVoteHistorySummary,
} from '@/lib/forum/vote-history';

export class ForumVoteHistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForumVoteHistoryError';
  }
}

export async function fetchUserForumVoteHistory(
  service: SupabaseClient,
  userId: string,
): Promise<ForumVoteHistoryItem[]> {
  const { data, error } = await service.rpc('get_user_forum_vote_history', {
    p_user_id: userId,
  });

  if (error) {
    throw new ForumVoteHistoryError(error.message);
  }

  return normalizeForumVoteHistory(data);
}

export async function getUserForumVoteHistory(userId: string): Promise<ForumVoteHistoryItem[]> {
  const service = getServiceSupabase();
  return fetchUserForumVoteHistory(service, userId);
}

export type ForumVoteInsights = {
  summary: ForumVoteHistorySummary;
  top_topics: { tag: string; count: number }[];
  recent: ForumVoteHistoryItem[];
};

export function buildForumVoteInsights(items: ForumVoteHistoryItem[]): ForumVoteInsights {
  return {
    summary: summarizeForumVoteHistory(items),
    top_topics: topForumVoteTopics(items),
    recent: items.slice(0, 5),
  };
}
