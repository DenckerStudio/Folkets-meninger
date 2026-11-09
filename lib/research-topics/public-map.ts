import type { ResearchTopicStatus } from '@/lib/admin/research/topic-brief-schema';
import {
  buildPublicResearchTopicBriefSections,
  buildPublicResearchTopicTeaser,
  buildResearchTopicPublicTitle,
} from '@/lib/research-topics/public-content';

/** DB fields allowed into the public mapper — never include admin `title`. */
export type ResearchTopicPublicSourceRow = {
  id: string;
  status: ResearchTopicStatus;
  publishable: boolean | null;
  output: unknown;
  finished_at: string | null;
  stortinget_issue_id: string | null;
  stortinget_poll_id: string | null;
};

export type PublicResearchTopicListItem = {
  id: string;
  topicTitle: string;
  teaser: string | null;
  finishedAt: string | null;
  sakId: string | null;
  pollId: string | null;
};

export type PublicResearchTopicDetail = PublicResearchTopicListItem & {
  sections: NonNullable<ReturnType<typeof buildPublicResearchTopicBriefSections>>;
};

export function isEligiblePublicResearchTopic(row: ResearchTopicPublicSourceRow): boolean {
  if (row.status !== 'done') return false;
  if (row.publishable !== true) return false;
  const title = buildResearchTopicPublicTitle(row.output);
  if (!title) return false;
  const sections = buildPublicResearchTopicBriefSections(row.output);
  if (!sections) return false;
  return true;
}

export function mapResearchTopicToPublicListItem(
  row: ResearchTopicPublicSourceRow,
): PublicResearchTopicListItem | null {
  if (!isEligiblePublicResearchTopic(row)) return null;

  const topicTitle = buildResearchTopicPublicTitle(row.output);
  if (!topicTitle) return null;

  const sakId = row.stortinget_issue_id?.trim() || null;
  const pollId = row.stortinget_poll_id?.trim() || null;

  return {
    id: row.id,
    topicTitle,
    teaser: buildPublicResearchTopicTeaser(row.output),
    finishedAt: row.finished_at,
    sakId,
    pollId,
  };
}

export function mapResearchTopicToPublicDetail(
  row: ResearchTopicPublicSourceRow,
): PublicResearchTopicDetail | null {
  const base = mapResearchTopicToPublicListItem(row);
  if (!base) return null;
  const sections = buildPublicResearchTopicBriefSections(row.output);
  if (!sections) return null;
  return { ...base, sections };
}
