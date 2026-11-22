import { isReplyWorthSuggested } from '@/lib/reddit-signals/reply-worth-gate';
import { rowMatchesSpikeFocus } from '@/lib/reddit-signals/spike-badge';
import type { RedditSignalAdminRow, RedditSignalListFilters, RedditSignalSortKey } from '@/lib/reddit-signals/types';

function sortValue(row: RedditSignalAdminRow, key: RedditSignalSortKey): number | null {
  switch (key) {
    case 'score':
      return row.score;
    case 'comments':
      return row.numComments;
    case 'contention':
      return row.contention;
    case 'relevance':
      return row.aiRelevance;
    case 'reply_worth':
      return row.replyWorth;
    case 'engagement':
      return row.engagement;
    case 'growth24h':
      return row.growth24h;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

export function filterRedditSignalRows(
  rows: RedditSignalAdminRow[],
  filters: RedditSignalListFilters,
): RedditSignalAdminRow[] {
  return rows.filter((row) => {
    if (filters.subreddit && row.subreddit !== filters.subreddit) return false;
    if (filters.topic) {
      const topic = row.topic?.toLowerCase() ?? '';
      if (!topic.includes(filters.topic.toLowerCase())) return false;
    }
    if (filters.cluster) {
      const cluster = row.clusterId?.trim() ?? '';
      if (cluster !== filters.cluster) return false;
    }
    if (filters.minScore !== null && row.score < filters.minScore) return false;
    if (filters.minComments !== null && row.numComments < filters.minComments) return false;
    if (filters.minRelevance !== null) {
      if (row.aiRelevance === null || row.aiRelevance < filters.minRelevance) return false;
    }
    if (filters.onlyWorthReplying && !isReplyWorthSuggested(row.replyWorth)) return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.hideRemoved && row.removalType) return false;
    if (filters.onlyWithSakLink && !row.linkedSakViaTopic) return false;
    if (!rowMatchesSpikeFocus(row, filters.spikeFocus)) return false;
    return true;
  });
}

export function sortRedditSignalRows(
  rows: RedditSignalAdminRow[],
  sort: RedditSignalSortKey,
): RedditSignalAdminRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = sortValue(a, sort);
    const bv = sortValue(b, sort);
    if (av === null && bv === null) {
      return b.lastSeenAt.localeCompare(a.lastSeenAt);
    }
    if (av === null) return 1;
    if (bv === null) return -1;
    if (bv !== av) return bv - av;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });
  return copy;
}