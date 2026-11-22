import type { RedditSignalSubreddit } from '@/lib/admin/oppfanget/types';
import { computeRedditSignalEngagement } from '@/lib/reddit-signals/engagement';
import { computeGrowth24hEngagement } from '@/lib/reddit-signals/growth';
import type {
  RedditReplyWorthStatus,
  RedditSignalAdminRow,
  RedditSignalSnapshotPoint,
  RedditSignalStatus,
} from '@/lib/reddit-signals/types';
import { REDDIT_REPLY_WORTH_STATUSES } from '@/lib/reddit-signals/types';

export type RedditSignalAdminDbRow = {
  id: string;
  reddit_id: string;
  subreddit: RedditSignalSubreddit;
  title: string;
  url: string;
  score: number;
  num_comments: number;
  contention: number | string;
  num_crossposts: number | null;
  upvote_ratio: number | null;
  posted_at: string;
  snapshot_at: string;
  first_seen_at: string;
  last_seen_at: string;
  topic: string | null;
  related_issue_id: string | null;
  removal_type: string | null;
  flair: string | null;
  ai_relevance: number | null;
  ai_reason: string | null;
  reply_worth: number | null;
  reply_worth_reason: string | null;
  reply_worth_status: string | null;
  cluster_id: string | null;
  status: RedditSignalStatus;
  status_reason: string | null;
};

function mapReplyWorthStatus(raw: string | null): RedditReplyWorthStatus | null {
  if (!raw) return null;
  return REDDIT_REPLY_WORTH_STATUSES.includes(raw as RedditReplyWorthStatus)
    ? (raw as RedditReplyWorthStatus)
    : null;
}

export type RedditSignalSnapshotDbRow = {
  signal_id: string;
  captured_at: string;
  score: number;
  num_comments: number;
  num_crossposts: number | null;
};

export type RedditSignalSakLink = {
  researchTopicId: string | null;
  stortingetIssueId: string | null;
};

export function mapSnapshotRow(row: RedditSignalSnapshotDbRow): RedditSignalSnapshotPoint {
  return {
    capturedAt: row.captured_at,
    score: row.score,
    numComments: row.num_comments,
    numCrossposts: row.num_crossposts,
  };
}

export function mapRedditSignalAdminRow(
  row: RedditSignalAdminDbRow,
  snapshots: RedditSignalSnapshotPoint[],
  sakLink: RedditSignalSakLink,
  relatedIssueTitle: string | null,
  nowMs = Date.now(),
): RedditSignalAdminRow {
  const contention =
    typeof row.contention === 'number' ? row.contention : Number.parseFloat(String(row.contention));
  const numCrossposts = row.num_crossposts;
  const growth24h = computeGrowth24hEngagement(
    { score: row.score, numComments: row.num_comments, numCrossposts },
    snapshots,
    nowMs,
  );

  return {
    id: row.id,
    redditId: row.reddit_id,
    subreddit: row.subreddit,
    title: row.title,
    url: row.url,
    score: row.score,
    numComments: row.num_comments,
    contention: Number.isFinite(contention) ? contention : 0,
    numCrossposts,
    upvoteRatio: row.upvote_ratio,
    postedAt: row.posted_at,
    snapshotAt: row.snapshot_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    topic: row.topic,
    relatedIssueId: row.related_issue_id,
    relatedIssueTitle,
    removalType: row.removal_type,
    flair: row.flair,
    aiRelevance: row.ai_relevance,
    aiReason: row.ai_reason,
    replyWorth: row.reply_worth,
    replyWorthReason: row.reply_worth_reason,
    replyWorthStatus: mapReplyWorthStatus(row.reply_worth_status),
    clusterId: row.cluster_id,
    status: row.status,
    statusReason: row.status_reason,
    researchTopicId: sakLink.researchTopicId,
    linkedSakViaTopic: Boolean(sakLink.stortingetIssueId),
    stortingetIssueId: sakLink.stortingetIssueId ?? row.related_issue_id,
    engagement: computeRedditSignalEngagement(row.score, row.num_comments, numCrossposts),
    growth24h,
    snapshots,
  };
}