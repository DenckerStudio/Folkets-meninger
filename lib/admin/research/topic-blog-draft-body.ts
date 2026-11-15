import {
  filterPublishableSources,
  parseTopicBriefSources,
  sectionIsEmpty,
  type ResearchTopicBriefOutput,
} from '@/lib/admin/research/topic-brief-schema';
import { normalizeBlogSlug } from '@/lib/blog/slug';
import { normalizeBlogExcerpt } from '@/lib/blog/text-limits';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function renderStringList(items: unknown[]): string {
  const lines: string[] = [];
  for (const item of items) {
    if (typeof item === 'string' && item.trim()) {
      lines.push(`- ${item.trim()}`);
    }
  }
  if (lines.length === 0) return '';
  return `${lines.join('\n')}\n\n`;
}

function renderPartyProposals(items: unknown[]): string {
  const blocks: string[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const party = typeof row.party === 'string' ? row.party.trim() : '';
    const proposal = typeof row.proposal === 'string' ? row.proposal.trim() : '';
    if (!party && !proposal) continue;
    if (party && proposal) {
      blocks.push(`### ${party}\n\n${proposal}`);
    } else if (proposal) {
      blocks.push(proposal);
    } else {
      blocks.push(`### ${party}`);
    }
  }
  if (blocks.length === 0) return '';
  return `${blocks.join('\n\n')}\n\n`;
}

function renderMediaCoverage(items: unknown[]): string {
  const blocks: string[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const headline = typeof row.headline === 'string' ? row.headline.trim() : '';
    const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
    if (!headline && !summary) continue;
    if (headline && summary) {
      blocks.push(`### ${headline}\n\n${summary}`);
    } else {
      blocks.push(headline || summary);
    }
  }
  if (blocks.length === 0) return '';
  return `${blocks.join('\n\n')}\n\n`;
}

function renderPolls(items: unknown[]): string {
  const lines: string[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const question = typeof row.question === 'string' ? row.question.trim() : '';
    const result = typeof row.result === 'string' ? row.result.trim() : '';
    if (!question && !result) continue;
    if (question && result) {
      lines.push(`- **${question}** — ${result}`);
    } else {
      lines.push(`- ${question || result}`);
    }
  }
  if (lines.length === 0) return '';
  return `${lines.join('\n')}\n\n`;
}

function renderLegacyBriefSourcesSection(
  sources: ReturnType<typeof filterPublishableSources>,
): string {
  if (sources.length === 0) return '';
  const lines = sources.map((source) => {
    const publisher = source.publisher?.trim() || 'Ukjent utgiver';
    return `- **[${source.grade}]** ${source.title.trim()} (${publisher})  \n  ${source.url}`;
  });
  return `${lines.join('\n')}\n\n`;
}

export function buildBriefBodyMarkdownFromOutput(output: ResearchTopicBriefOutput, includeBriefSources = true): string {
  const parts: string[] = [];

  if (!sectionIsEmpty(output.current_rules)) {
    parts.push('## Dagens regler\n\n');
    parts.push(renderStringList(output.current_rules.items));
  }
  if (!sectionIsEmpty(output.party_proposals)) {
    parts.push('## Partienes forslag\n\n');
    parts.push(renderPartyProposals(output.party_proposals.items));
  }
  if (!sectionIsEmpty(output.media_coverage)) {
    parts.push('## Mediedekning\n\n');
    parts.push(renderMediaCoverage(output.media_coverage.items));
  }
  if (!sectionIsEmpty(output.polls)) {
    parts.push('## Meningsmålinger\n\n');
    parts.push(renderPolls(output.polls.items));
  }

  if (includeBriefSources) {
    const publishableSources = filterPublishableSources(parseTopicBriefSources(output.sources));
    const sourcesBody = renderLegacyBriefSourcesSection(publishableSources);
    if (sourcesBody) {
      parts.push('## Kilder\n\n');
      parts.push(sourcesBody);
    }
  }

  return parts.join('').trim();
}

export function pickBlogExcerptFromBody(bodyMarkdown: string, title: string): string {
  const plain = bodyMarkdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[([A-D])\]/g, '')
    .replace(/\[\^\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = plain || title;
  return normalizeBlogExcerpt(candidate);
}

export function topicBlogSlugFromTitle(title: string, variantId?: string | null): string {
  let slug = normalizeBlogSlug(title);
  if (variantId?.trim()) {
    const suffix = variantId.replace(/-/g, '').slice(0, 8);
    slug = `${slug}-${suffix}`;
  }
  return slug;
}