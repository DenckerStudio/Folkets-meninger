import type { ResearchTopicSourceKind, ResearchTopicStatus } from '@/lib/admin/research/topic-brief-schema';

export const RESEARCH_TOPIC_WEBHOOK_KIND = 'topic_brief' as const;

export type ResearchTopicWebhookBody = {
  request_id: string;
  kind: typeof RESEARCH_TOPIC_WEBHOOK_KIND;
  topic_id: string;
  source_kind: ResearchTopicSourceKind;
  source_ref: string;
  title?: string;
  context?: Record<string, unknown>;
  force?: boolean;
};

export function researchTopicWebhookPath(): string {
  return 'folkets-research-topic-brief';
}

export type ResearchTopicSnapshot = {
  topicId: string;
  status: ResearchTopicStatus;
  requestId: string;
  publishable: boolean | null;
  error: string | null;
  updatedAt: string;
};

export type ResearchTopicRow = {
  id: string;
  source_kind: ResearchTopicSourceKind;
  cluster_id: string | null;
  reddit_signal_id: string | null;
  reddit_id: string | null;
  subreddit: string | null;
  title: string | null;
  status: ResearchTopicStatus;
  request_id: string;
  output: unknown;
  previous_output: unknown;
  publishable: boolean | null;
  blocking_reason: string | null;
  error: string | null;
  heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  stortinget_issue_id: string | null;
  stortinget_poll_id: string | null;
};

export type ResearchTopicDetail = ResearchTopicRow;
