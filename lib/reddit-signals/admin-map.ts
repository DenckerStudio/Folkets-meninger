import type { OppfangetRedditRow, RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';

export type RedditSignalDbRow = {
  id: string;
  reddit_id: string;
  subreddit: RedditSignalSubreddit;
  title: string;
  url: string;
  score: number;
  num_comments: number;
  contention: number | string;
  posted_at: string;
  snapshot_at: string;
  first_seen_at: string;
  last_seen_at: string;
  topic: string | null;
  related_issue_id: string | null;
  related_similarity: number | null;
};

export function mapRedditSignalToOppfangetRow(row: RedditSignalDbRow): OppfangetRedditRow {
  const contention =
    typeof row.contention === 'number' ? row.contention : Number.parseFloat(String(row.contention));

  return {
    rowKind: 'reddit',
    id: row.id,
    title: row.title,
    displayType: 'reddit',
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    subreddit: row.subreddit,
    redditId: row.reddit_id,
    url: row.url,
    score: row.score,
    numComments: row.num_comments,
    contention: Number.isFinite(contention) ? contention : 0,
    postedAt: row.posted_at,
    snapshotAt: row.snapshot_at,
    topic: row.topic,
    relatedIssueId: row.related_issue_id,
    relatedSimilarity: row.related_similarity,
  };
}

export const REDDIT_SIGNALS_LIST_LIMIT = 500;
