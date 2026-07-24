import { reelVoteOptionLabel } from '@/lib/forum/prompt-vote-options';

export type ForumVoteHistoryItem = {
  prompt_id: string;
  option_id: string;
  option_label: string;
  voted_at: string;
  question: string;
  stortinget_issue_id: string | null;
  sak_title: string | null;
  topic_tags: string[];
};

export type ForumVoteHistorySummary = {
  total: number;
  ja: number;
  nei: number;
  other: number;
  unique_saker: number;
};

export function normalizeForumVoteHistoryRow(row: Record<string, unknown>): ForumVoteHistoryItem | null {
  const promptId = row.prompt_id;
  const optionId = row.option_id;
  const votedAt = row.voted_at;
  const question = row.question;

  if (
    typeof promptId !== 'string' ||
    typeof optionId !== 'string' ||
    typeof votedAt !== 'string' ||
    typeof question !== 'string'
  ) {
    return null;
  }

  const topicTags = Array.isArray(row.topic_tags)
    ? row.topic_tags.map((tag) => String(tag)).filter(Boolean)
    : [];

  return {
    prompt_id: promptId,
    option_id: optionId,
    option_label: reelVoteOptionLabel(optionId, optionId === 'ja' ? 'Ja' : optionId === 'nei' ? 'Nei' : optionId),
    voted_at: votedAt,
    question,
    stortinget_issue_id:
      typeof row.stortinget_issue_id === 'string' ? row.stortinget_issue_id : null,
    sak_title: typeof row.sak_title === 'string' ? row.sak_title : null,
    topic_tags: topicTags,
  };
}

export function normalizeForumVoteHistory(data: unknown): ForumVoteHistoryItem[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => normalizeForumVoteHistoryRow(row as Record<string, unknown>))
    .filter((row): row is ForumVoteHistoryItem => row !== null);
}

export function summarizeForumVoteHistory(items: ForumVoteHistoryItem[]): ForumVoteHistorySummary {
  const ja = items.filter((item) => item.option_id === 'ja').length;
  const nei = items.filter((item) => item.option_id === 'nei').length;
  const uniqueSaker = new Set(
    items.map((item) => item.stortinget_issue_id).filter((id): id is string => Boolean(id)),
  ).size;

  return {
    total: items.length,
    ja,
    nei,
    other: items.length - ja - nei,
    unique_saker: uniqueSaker,
  };
}

export function topForumVoteTopics(
  items: ForumVoteHistoryItem[],
  limit = 5,
): { tag: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of item.topic_tags) {
      if (tag === 'sak_mening') continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
