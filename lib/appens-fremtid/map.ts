import {
  isRoadmapStatus,
  isSuggestionAudience,
  isSuggestionCategory,
  isSuggestionStatus,
  isSuggestionVote,
  type ChangelogEntry,
  type RoadmapItem,
  type SuggestionRecord,
} from '@/lib/appens-fremtid/constants';

function asCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function mapSuggestionRow(row: Record<string, unknown>): SuggestionRecord | null {
  if (typeof row.id !== 'string' || typeof row.user_id !== 'string') return null;
  const body = typeof row.body === 'string' ? row.body : '';
  const title =
    typeof row.title === 'string' && row.title.trim()
      ? row.title
      : body.slice(0, 80);
  if (!title || !body) return null;

  const status = isSuggestionStatus(row.status) ? row.status : 'new';
  const category = isSuggestionCategory(row.category) ? row.category : 'annet';
  const audience = isSuggestionAudience(row.audience) ? row.audience : 'alle';

  return {
    id: row.id,
    userId: row.user_id,
    title,
    body,
    category,
    audience,
    status,
    votingOpen: row.voting_open === true,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    handledAt: typeof row.handled_at === 'string' ? row.handled_at : null,
    handledBy: typeof row.handled_by === 'string' ? row.handled_by : null,
    authorName: typeof row.author_name === 'string' && row.author_name.trim() ? row.author_name : null,
    upCount: asCount(row.up_count),
    downCount: asCount(row.down_count),
    myVote: isSuggestionVote(row.my_vote) ? row.my_vote : null,
  };
}

export function mapChangelogRow(row: Record<string, unknown>): ChangelogEntry | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string') {
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
  };
}

export function mapRoadmapRow(row: Record<string, unknown>): RoadmapItem | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.body !== 'string') {
    return null;
  }
  if (!isRoadmapStatus(row.status)) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    sortOrder: asCount(row.sort_order),
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}
