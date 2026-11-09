import type { ResearchTopicStatus } from '@/lib/admin/research/topic-brief-schema';
import {
  mapResearchTopicToPublicDetail,
  mapResearchTopicToPublicListItem,
  type PublicResearchTopicDetail,
  type PublicResearchTopicListItem,
  type ResearchTopicPublicSourceRow,
} from '@/lib/research-topics/public-map';
import { getServiceSupabase } from '@/lib/supabase';

const PUBLIC_TOPIC_SELECT =
  'id, status, publishable, output, finished_at, stortinget_issue_id, stortinget_poll_id';

function parsePublicSourceRow(raw: Record<string, unknown>): ResearchTopicPublicSourceRow {
  return {
    id: String(raw.id),
    status: raw.status as ResearchTopicStatus,
    publishable: typeof raw.publishable === 'boolean' ? raw.publishable : null,
    output: raw.output ?? {},
    finished_at: typeof raw.finished_at === 'string' ? raw.finished_at : null,
    stortinget_issue_id:
      typeof raw.stortinget_issue_id === 'string' ? raw.stortinget_issue_id : null,
    stortinget_poll_id:
      typeof raw.stortinget_poll_id === 'string' ? raw.stortinget_poll_id : null,
  };
}

export async function listPublicResearchTopics(
  limit = 12,
): Promise<PublicResearchTopicListItem[]> {
  const capped = Math.min(Math.max(limit, 1), 24);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_topics')
    .select(PUBLIC_TOPIC_SELECT)
    .eq('status', 'done')
    .eq('publishable', true)
    .order('finished_at', { ascending: false, nullsFirst: false })
    .limit(capped * 3);

  if (error || !data) return [];

  const items: PublicResearchTopicListItem[] = [];
  for (const row of data as Record<string, unknown>[]) {
    const mapped = mapResearchTopicToPublicListItem(parsePublicSourceRow(row));
    if (mapped) items.push(mapped);
    if (items.length >= capped) break;
  }
  return items;
}

export async function getPublicResearchTopicById(
  topicId: string,
): Promise<PublicResearchTopicDetail | null> {
  const id = topicId.trim();
  if (!id) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('research_topics')
    .select(PUBLIC_TOPIC_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapResearchTopicToPublicDetail(parsePublicSourceRow(data as Record<string, unknown>));
}
