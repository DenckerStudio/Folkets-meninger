import {
  filterPublishableSources,
  parseTopicBriefSources,
  researchTopicBriefOutputSchema,
  sectionIsEmpty,
  type ResearchTopicBriefOutput,
} from '@/lib/admin/research/topic-brief-schema';
import type { ResearchTopicRow } from '@/lib/admin/research/topic-types';
import { getServiceSupabase } from '@/lib/supabase';
import {
  STORTINGET_POLL_NEUTRAL_SUMMARY_MAX,
  STORTINGET_POLL_TITLE_MAX,
} from '@/lib/polls/stortinget-poll-admin';
import type { PollSourceUrl } from '@/lib/polls/types';
import { adminPublishStortingetPoll } from '@/lib/polls/service';
import { getStortingetSakUrl } from '@/lib/stortinget-horinger';
import type { ClosesAtApplyAction } from '@/lib/polls/stortinget-poll-admin';
import {
  isResearchTopicDedicatedIssueId,
  researchTopicDedicatedIssueId,
} from '@/lib/sak/research-topic-dedicated-issue';
import { validateResearchTopicSakPollIngress } from '@/lib/admin/research/topic-sak-poll-client';

export {
  isResearchTopicDedicatedIssueId,
  researchTopicDedicatedIssueId,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function parseResearchTopicBriefOutput(output: unknown): ResearchTopicBriefOutput | null {
  const parsed = researchTopicBriefOutputSchema.safeParse(output);
  return parsed.success ? parsed.data : null;
}

export function buildResearchTopicPublicTitle(output: unknown): string | null {
  const brief = parseResearchTopicBriefOutput(output);
  const title = brief?.topic_title?.trim();
  return title ? title : null;
}

function linesFromStringItems(items: unknown[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (typeof item === 'string' && item.trim()) {
      lines.push(item.trim());
    }
  }
  return lines;
}

function linesFromPartyProposals(items: unknown[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const party = typeof row.party === 'string' ? row.party.trim() : '';
    const proposal = typeof row.proposal === 'string' ? row.proposal.trim() : '';
    if (!party && !proposal) continue;
    if (party && proposal) {
      lines.push(`${party}: ${proposal}`);
    } else {
      lines.push(party || proposal);
    }
  }
  return lines;
}

function linesFromMedia(items: unknown[]): string[] {
  const lines: string[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const headline = typeof row.headline === 'string' ? row.headline.trim() : '';
    const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
    if (!headline && !summary) continue;
    if (headline && summary) {
      lines.push(`${headline}. ${summary}`);
    } else {
      lines.push(headline || summary);
    }
  }
  return lines;
}

export type ResearchTopicNeutralSummaryBuild = {
  text: string;
  truncated: boolean;
  hasContent: boolean;
};

export function buildResearchTopicNeutralSummary(output: unknown): ResearchTopicNeutralSummaryBuild {
  const brief = parseResearchTopicBriefOutput(output);
  if (!brief) {
    return { text: '', truncated: false, hasContent: false };
  }

  const chunks: string[] = [];

  if (!sectionIsEmpty(brief.current_rules)) {
    const rules = linesFromStringItems(brief.current_rules.items);
    if (rules.length > 0) {
      chunks.push(`Dette gjelder i dag: ${rules.join(' ')}`);
    }
  }

  if (!sectionIsEmpty(brief.party_proposals)) {
    const parties = linesFromPartyProposals(brief.party_proposals.items);
    if (parties.length > 0) {
      chunks.push(`Partiene foreslår blant annet: ${parties.join(' ')}`);
    }
  }

  if (!sectionIsEmpty(brief.media_coverage)) {
    const media = linesFromMedia(brief.media_coverage.items);
    if (media.length > 0) {
      chunks.push(`I mediedebatten: ${media.slice(0, 3).join(' ')}`);
    }
  }

  const text = chunks.join('\n\n').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { text: '', truncated: false, hasContent: false };
  }
  if (text.length <= STORTINGET_POLL_NEUTRAL_SUMMARY_MAX) {
    return { text, truncated: false, hasContent: true };
  }
  return {
    text: `${text.slice(0, STORTINGET_POLL_NEUTRAL_SUMMARY_MAX - 1).trimEnd()}…`,
    truncated: true,
    hasContent: true,
  };
}

export function pickResearchTopicPublicSource(output: unknown): PollSourceUrl | null {
  const brief = parseResearchTopicBriefOutput(output);
  if (!brief) return null;
  const sources = filterPublishableSources(parseTopicBriefSources(brief.sources));
  const primary = sources[0];
  if (!primary?.url?.trim()) return null;
  const label = primary.publisher?.trim() || primary.title.trim() || 'Kilde';
  return { label, url: primary.url.trim() };
}

export function buildResearchTopicPollSourceUrls(
  issueId: string,
  output: unknown,
): PollSourceUrl[] {
  const trimmedIssue = issueId.trim();
  const urls: PollSourceUrl[] = [];
  if (trimmedIssue && !isResearchTopicDedicatedIssueId(trimmedIssue)) {
    urls.push({ label: 'Stortinget', url: getStortingetSakUrl(trimmedIssue) });
  }
  const primary = pickResearchTopicPublicSource(output);
  if (primary) {
    urls.push(primary);
  }
  return urls;
}

export function validateResearchTopicPublicString(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('reddit')) {
    return 'Teksten kan ikke nevne Reddit';
  }
  return null;
}

export async function syncDedicatedResearchTopicIssueText(input: {
  issueId: string;
  title: string;
  neutralSummary: string;
}): Promise<void> {
  const issueId = input.issueId.trim();
  if (!isResearchTopicDedicatedIssueId(issueId)) {
    return;
  }
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('stortinget_issues')
    .update({
      title: input.title.trim(),
      summary: input.neutralSummary.trim() || null,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', issueId);
  if (error) throw error;
}

export type ResearchTopicSakPollLookup = {
  issueId: string | null;
  pollId: string | null;
  pollStatus: string | null;
  pollTitle: string | null;
  suggestedIssueId: string;
  defaultTitle: string | null;
  defaultNeutralSummary: string;
  defaultNeutralSummaryTruncated: boolean;
  defaultNeutralSummaryHasContent: boolean;
  sourceUrls: PollSourceUrl[];
  stortingetPageUrl: string | null;
  titleOverLimit: boolean;
  dedicatedSak: boolean;
};

export async function resolveResearchTopicSuggestedIssueId(
  topic: ResearchTopicRow,
): Promise<string> {
  if (topic.stortinget_issue_id?.trim()) {
    return topic.stortinget_issue_id.trim();
  }

  const supabase = getServiceSupabase();

  if (topic.source_kind === 'cluster' && topic.cluster_id) {
    const { data } = await supabase
      .from('action_clusters')
      .select('related_issue_id')
      .eq('id', topic.cluster_id)
      .maybeSingle();
    const related = typeof data?.related_issue_id === 'string' ? data.related_issue_id.trim() : '';
    if (related) return related;
  }

  if (topic.source_kind === 'reddit' && topic.reddit_signal_id) {
    const { data } = await supabase
      .from('reddit_signals')
      .select('related_issue_id')
      .eq('id', topic.reddit_signal_id)
      .maybeSingle();
    const related = typeof data?.related_issue_id === 'string' ? data.related_issue_id.trim() : '';
    if (related) return related;
  }

  return researchTopicDedicatedIssueId(topic.id);
}

export async function lookupResearchTopicSakPoll(
  topic: ResearchTopicRow,
): Promise<ResearchTopicSakPollLookup> {
  const defaultTitle = buildResearchTopicPublicTitle(topic.output);
  const neutralBuild = buildResearchTopicNeutralSummary(topic.output);
  const defaultNeutralSummary = neutralBuild.text;
  const suggestedIssueId = await resolveResearchTopicSuggestedIssueId(topic);
  const sourceUrls = buildResearchTopicPollSourceUrls(suggestedIssueId, topic.output);
  const dedicatedSak = isResearchTopicDedicatedIssueId(suggestedIssueId);

  let pollStatus: string | null = null;
  let pollTitle: string | null = null;
  let issueId = topic.stortinget_issue_id?.trim() || null;
  let pollId = topic.stortinget_poll_id?.trim() || null;

  if (pollId) {
    const supabase = getServiceSupabase();
    const { data: poll } = await supabase
      .from('polls')
      .select('id, status, title, track, stortinget_issue_id')
      .eq('id', pollId)
      .maybeSingle();
    if (poll && String(poll.track) === 'stortinget') {
      pollStatus = typeof poll.status === 'string' ? poll.status : null;
      pollTitle = typeof poll.title === 'string' ? poll.title : null;
      if (!issueId && typeof poll.stortinget_issue_id === 'string') {
        issueId = poll.stortinget_issue_id;
      }
    } else {
      pollId = null;
    }
  }

  const stortingetPageUrl =
    issueId && !isResearchTopicDedicatedIssueId(issueId)
      ? getStortingetSakUrl(issueId)
      : null;

  return {
    issueId,
    pollId,
    pollStatus,
    pollTitle,
    suggestedIssueId,
    defaultTitle,
    defaultNeutralSummary,
    defaultNeutralSummaryTruncated: neutralBuild.truncated,
    defaultNeutralSummaryHasContent: neutralBuild.hasContent,
    sourceUrls,
    stortingetPageUrl,
    titleOverLimit: (defaultTitle?.length ?? 0) > STORTINGET_POLL_TITLE_MAX,
    dedicatedSak,
  };
}

export async function persistResearchTopicSakPollLink(input: {
  topicId: string;
  issueId: string;
  pollId: string;
}): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('research_topics')
    .update({
      stortinget_issue_id: input.issueId.trim(),
      stortinget_poll_id: input.pollId,
    })
    .eq('id', input.topicId.trim());
  if (error) throw error;
}

export type PublishResearchTopicSakPollInput = {
  topicId: string;
  issueId: string;
  title: string;
  neutralSummary: string;
  sourceUrls: PollSourceUrl[];
  closesAt: ClosesAtApplyAction;
  forceNew: boolean;
  existingPollId: string | null;
};

export async function publishResearchTopicSakPoll(
  input: PublishResearchTopicSakPollInput,
): Promise<{ ok: true; pollId: string; issueId: string } | { ok: false; error: string }> {
  const titlePublicError = validateResearchTopicPublicString(input.title);
  if (titlePublicError) {
    return { ok: false, error: titlePublicError };
  }
  const summaryPublicError = validateResearchTopicPublicString(input.neutralSummary);
  if (summaryPublicError) {
    return { ok: false, error: summaryPublicError };
  }

  const ingressError = validateResearchTopicSakPollIngress(input.neutralSummary);
  if (ingressError) {
    return { ok: false, error: ingressError };
  }

  for (const source of input.sourceUrls) {
    if (source.label) {
      const labelError = validateResearchTopicPublicString(source.label);
      if (labelError) return { ok: false, error: labelError };
    }
    const urlError = validateResearchTopicPublicString(source.url);
    if (urlError) return { ok: false, error: urlError };
  }

  if (!input.forceNew && input.existingPollId) {
    const supabase = getServiceSupabase();
    const { data: existing } = await supabase
      .from('polls')
      .select('id, status, track')
      .eq('id', input.existingPollId)
      .maybeSingle();
    const status = typeof existing?.status === 'string' ? existing.status : '';
    if (
      existing &&
      String(existing.track) === 'stortinget' &&
      (status === 'open' || status === 'closed' || status === 'draft')
    ) {
      return {
        ok: false,
        error: 'Det finnes allerede en koblet avstemning. Bekreft at du vil opprette en ny.',
      };
    }
  }

  let closesAtIso: string | null = null;
  let clearClosesAt = false;
  switch (input.closesAt.action) {
    case 'skip':
      closesAtIso = null;
      clearClosesAt = false;
      break;
    case 'clear':
      closesAtIso = null;
      clearClosesAt = true;
      break;
    case 'set':
      closesAtIso = input.closesAt.iso;
      clearClosesAt = false;
      break;
    default: {
      const _never: never = input.closesAt;
      return _never;
    }
  }

  try {
    const pollId = await adminPublishStortingetPoll({
      issueId: input.issueId.trim(),
      title: input.title.trim(),
      neutralSummary: input.neutralSummary,
      sourceUrls: input.sourceUrls,
      closesAt: closesAtIso,
      clearClosesAt,
    });

    await syncDedicatedResearchTopicIssueText({
      issueId: input.issueId.trim(),
      title: input.title.trim(),
      neutralSummary: input.neutralSummary,
    });

    await persistResearchTopicSakPollLink({
      topicId: input.topicId,
      issueId: input.issueId.trim(),
      pollId,
    });

    return { ok: true, pollId, issueId: input.issueId.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil';
    if (/130 characters/i.test(message) || /maks 130/i.test(message)) {
      return { ok: false, error: `Tittelen kan være maks ${STORTINGET_POLL_TITLE_MAX} tegn.` };
    }
    return { ok: false, error: 'Kunne ikke publisere avstemningen. Prøv igjen senere.' };
  }
}
