import type { SakIssueMeta } from '@/lib/stortinget-detail-cache';
import type { SakListItem, StortingetSakDetail } from '@/lib/stortinget';
import { resolveSakStatusFromSources } from '@/lib/sak-status';
import { getServiceSupabase } from '@/lib/supabase';
import {
  isResearchTopicDedicatedIssueId,
  parseResearchTopicIdFromDedicatedSakId,
} from '@/lib/sak/research-topic-dedicated-issue';
import { buildResearchTopicNeutralSummary } from '@/lib/admin/research/topic-sak-poll';
import { buildResearchTopicPublicTitle } from '@/lib/research-topics/public-content';

const EMPTY_VOTES = { for: 0, against: 0, abstain: 0, total: 0 };

export function buildDedicatedResearchTopicSakDetail(
  sakId: string,
  row: { title: string | null; summary: string | null },
): StortingetSakDetail {
  const title = row.title?.trim() || 'Sak';
  const summary = row.summary?.trim() || '';
  return {
    id: 0,
    korttittel: title,
    tittel: summary || title,
    ferdigbehandlet: false,
    emne_liste: [],
  };
}

function buildBundleFromTitleSummary(
  sakId: string,
  title: string,
  summary: string,
  issueMetaPartial?: Partial<SakIssueMeta>,
): {
  sak: SakListItem;
  detail: StortingetSakDetail;
  issueMeta: SakIssueMeta | null;
} {
  const detail = buildDedicatedResearchTopicSakDetail(sakId, { title, summary });
  const issueMeta: SakIssueMeta = {
    lastUpdatedAt: issueMetaPartial?.lastUpdatedAt ?? null,
    status: issueMetaPartial?.status ?? 'pending',
    ferdigbehandlet: issueMetaPartial?.ferdigbehandlet ?? null,
    votingClosesAt: issueMetaPartial?.votingClosesAt ?? null,
  };

  const sak: SakListItem = {
    id: sakId,
    title,
    summary,
    category: 'Tema',
    date:
      (issueMeta.lastUpdatedAt ?? '').split('T')[0] ||
      new Date().toISOString().split('T')[0],
    votes: EMPTY_VOTES,
    status: issueMeta.status,
    sakKind: null,
    henvisning: null,
    dokumentgruppe: null,
    votingOpen: false,
    votingDaysLeft: null,
  };

  return { sak, detail, issueMeta };
}

async function loadDedicatedResearchTopicBundleFromTopic(
  sakId: string,
): Promise<{
  sak: SakListItem;
  detail: StortingetSakDetail;
  issueMeta: SakIssueMeta | null;
} | null> {
  const topicId = parseResearchTopicIdFromDedicatedSakId(sakId);
  if (!topicId) return null;

  const service = getServiceSupabase();
  const { data: topic, error } = await service
    .from('research_topics')
    .select('id, output, updated_at')
    .eq('id', topicId)
    .maybeSingle();

  if (error || !topic) return null;

  const title = buildResearchTopicPublicTitle(topic.output);
  if (!title) return null;

  const neutral = buildResearchTopicNeutralSummary(topic.output);
  const summary = neutral.text || title;

  return buildBundleFromTitleSummary(sakId, title, summary, {
    lastUpdatedAt: typeof topic.updated_at === 'string' ? topic.updated_at : null,
    status: 'pending',
    ferdigbehandlet: false,
    votingClosesAt: null,
  });
}

export async function getDedicatedResearchTopicSakBundle(
  sakId: string,
): Promise<{
  sak: SakListItem;
  detail: StortingetSakDetail;
  issueMeta: SakIssueMeta | null;
} | null> {
  if (!isResearchTopicDedicatedIssueId(sakId)) {
    return null;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from('stortinget_issues')
    .select('title, summary, status, ferdigbehandlet, voting_closes_at, last_updated_at')
    .eq('id', sakId)
    .maybeSingle();

  if (error || !data) {
    return loadDedicatedResearchTopicBundleFromTopic(sakId);
  }

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const summary = typeof data.summary === 'string' ? data.summary.trim() : '';

  if (!title) {
    return loadDedicatedResearchTopicBundleFromTopic(sakId);
  }

  const issueMeta: SakIssueMeta = {
    lastUpdatedAt: data.last_updated_at ?? null,
    status: resolveSakStatusFromSources({
      ferdigbehandlet:
        typeof data.ferdigbehandlet === 'boolean' ? data.ferdigbehandlet : null,
      cachedStatus: typeof data.status === 'string' ? data.status : null,
    }),
    ferdigbehandlet:
      typeof data.ferdigbehandlet === 'boolean' ? data.ferdigbehandlet : null,
    votingClosesAt: data.voting_closes_at ?? null,
  };

  return buildBundleFromTitleSummary(sakId, title, summary || title, issueMeta);
}