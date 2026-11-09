import {
  filterPublishableSources,
  parseTopicBriefSources,
  researchTopicBriefOutputSchema,
  sectionIsEmpty,
  type ResearchTopicBriefOutput,
} from '@/lib/admin/research/topic-brief-schema';
import {
  assertResearchTopicPublicStrings,
  validateResearchTopicPublicString,
} from '@/lib/research-topics/public-strings';

export function parsePublicResearchTopicBriefOutput(output: unknown): ResearchTopicBriefOutput | null {
  const parsed = researchTopicBriefOutputSchema.safeParse(output);
  return parsed.success ? parsed.data : null;
}

export function buildResearchTopicPublicTitle(output: unknown): string | null {
  const brief = parsePublicResearchTopicBriefOutput(output);
  const title = brief?.topic_title?.trim();
  if (!title) return null;
  if (validateResearchTopicPublicString(title)) return null;
  return title;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
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

export function buildPublicResearchTopicTeaser(output: unknown, maxLength = 220): string | null {
  const brief = parsePublicResearchTopicBriefOutput(output);
  if (!brief) return null;

  const chunks: string[] = [];

  if (!sectionIsEmpty(brief.current_rules)) {
    const rules = linesFromStringItems(brief.current_rules.items);
    if (rules.length > 0) {
      chunks.push(rules[0] ?? '');
    }
  }

  if (chunks.length === 0 && !sectionIsEmpty(brief.media_coverage)) {
    const media = linesFromMedia(brief.media_coverage.items);
    if (media.length > 0) {
      chunks.push(media[0] ?? '');
    }
  }

  if (chunks.length === 0 && !sectionIsEmpty(brief.party_proposals)) {
    const parties = linesFromPartyProposals(brief.party_proposals.items);
    if (parties.length > 0) {
      chunks.push(parties[0] ?? '');
    }
  }

  const joined = chunks.join(' ').replace(/\s+/g, ' ').trim();
  if (!joined) return null;
  if (validateResearchTopicPublicString(joined)) return null;
  if (joined.length <= maxLength) return joined;
  return `${joined.slice(0, maxLength - 1).trimEnd()}…`;
}

export type PublicResearchTopicBriefSections = {
  currentRules: string[];
  partyProposals: Array<{ party: string; proposal: string }>;
  mediaCoverage: Array<{ headline: string; summary: string }>;
  polls: Array<{ question: string; result: string }>;
  sources: ReturnType<typeof filterPublishableSources>;
  generatedAt: string | null;
};

export function buildPublicResearchTopicBriefSections(
  output: unknown,
): PublicResearchTopicBriefSections | null {
  const brief = parsePublicResearchTopicBriefOutput(output);
  if (!brief) return null;

  const currentRules = sectionIsEmpty(brief.current_rules)
    ? []
    : linesFromStringItems(brief.current_rules.items);

  const partyProposals: PublicResearchTopicBriefSections['partyProposals'] = [];
  if (!sectionIsEmpty(brief.party_proposals)) {
    for (const item of brief.party_proposals.items) {
      const row = asRecord(item);
      if (!row) continue;
      const party = typeof row.party === 'string' ? row.party.trim() : '';
      const proposal = typeof row.proposal === 'string' ? row.proposal.trim() : '';
      if (!party && !proposal) continue;
      partyProposals.push({ party, proposal });
    }
  }

  const mediaCoverage: PublicResearchTopicBriefSections['mediaCoverage'] = [];
  if (!sectionIsEmpty(brief.media_coverage)) {
    for (const item of brief.media_coverage.items) {
      const row = asRecord(item);
      if (!row) continue;
      const headline = typeof row.headline === 'string' ? row.headline.trim() : '';
      const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
      if (!headline && !summary) continue;
      mediaCoverage.push({ headline, summary });
    }
  }

  const polls: PublicResearchTopicBriefSections['polls'] = [];
  if (!sectionIsEmpty(brief.polls)) {
    for (const item of brief.polls.items) {
      const row = asRecord(item);
      if (!row) continue;
      const question = typeof row.question === 'string' ? row.question.trim() : '';
      const result = typeof row.result === 'string' ? row.result.trim() : '';
      if (!question && !result) continue;
      polls.push({ question, result });
    }
  }

  const sources = filterPublishableSources(parseTopicBriefSources(brief.sources));
  const generatedAt =
    typeof brief.generated_at === 'string' && brief.generated_at.trim()
      ? brief.generated_at.trim()
      : null;

  const stringsToCheck: string[] = [
    ...currentRules,
    ...partyProposals.flatMap((p) => [p.party, p.proposal]),
    ...mediaCoverage.flatMap((m) => [m.headline, m.summary]),
    ...polls.flatMap((p) => [p.question, p.result]),
    ...sources.flatMap((s) => [s.title, s.url, s.publisher ?? '']),
  ];

  if (assertResearchTopicPublicStrings(stringsToCheck)) {
    return null;
  }

  return {
    currentRules,
    partyProposals,
    mediaCoverage,
    polls,
    sources,
    generatedAt,
  };
}
