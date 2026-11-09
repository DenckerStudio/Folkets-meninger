import {
  filterPublishableSources,
  parseTopicBriefSources,
  researchTopicBriefOutputSchema,
  sectionIsEmpty,
  type ResearchTopicBriefOutput,
} from '@/lib/admin/research/topic-brief-schema';
import type { CreateBlogDraftInput } from '@/lib/blog/service';
import { normalizeBlogSlug, isValidBlogSlug } from '@/lib/blog/slug';
import { normalizeBlogExcerpt, normalizeBlogTitle } from '@/lib/blog/text-limits';
import { cmsBlogOpsListBySourceEventPrefix } from '@/lib/cms/blog-ops-client';

export const RESEARCH_TOPIC_BLOG_SOURCE_PREFIX = 'research_topic:';

export function researchTopicBlogSourceEvent(
  requestId: string,
  variantId?: string | null,
): string {
  const base = `${RESEARCH_TOPIC_BLOG_SOURCE_PREFIX}${requestId.trim()}`;
  const variant = variantId?.trim();
  return variant ? `${base}:${variant}` : base;
}

export type ResearchTopicBlogDraftRef = {
  id: string;
  slug: string;
  adminUrl: string;
  cmsStatus: 'draft' | 'published' | 'unknown';
  sourceEvent: string | null;
  updatedAt: string | null;
};

export function researchTopicBlogSourceEventPrefix(requestId: string): string {
  return researchTopicBlogSourceEvent(requestId);
}

export async function listResearchTopicBlogDrafts(requestId: string): Promise<{
  drafts: ResearchTopicBlogDraftRef[];
  lookupFailed: boolean;
}> {
  const prefix = researchTopicBlogSourceEventPrefix(requestId);
  const listed = await cmsBlogOpsListBySourceEventPrefix(prefix);
  if (listed === null) {
    return { drafts: [], lookupFailed: true };
  }
  return {
    lookupFailed: false,
    drafts: listed.map((row) => ({
      id: row.id,
      slug: row.slug,
      adminUrl: row.adminUrl,
      cmsStatus: row.cmsStatus,
      sourceEvent: row.sourceEvent,
      updatedAt: row.updatedAt,
    })),
  };
}

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

function renderSourcesSection(
  sources: ReturnType<typeof filterPublishableSources>,
): string {
  if (sources.length === 0) return '';
  const lines = sources.map((source) => {
    const publisher = source.publisher?.trim() || 'Ukjent utgiver';
    return `- **[${source.grade}]** ${source.title.trim()} (${publisher})  \n  ${source.url}`;
  });
  return `${lines.join('\n')}\n\n`;
}

function buildBodyMarkdown(output: ResearchTopicBriefOutput): string {
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

  const publishableSources = filterPublishableSources(parseTopicBriefSources(output.sources));
  const sourcesBody = renderSourcesSection(publishableSources);
  if (sourcesBody) {
    parts.push('## Kilder\n\n');
    parts.push(sourcesBody);
  }

  return parts.join('').trim();
}

function pickExcerpt(bodyMarkdown: string, title: string): string {
  const plain = bodyMarkdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\[([A-D])\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = plain || title;
  return normalizeBlogExcerpt(candidate);
}

function topicBlogSlugFromTitle(title: string, variantId?: string | null): string {
  let slug = normalizeBlogSlug(title);
  if (variantId?.trim()) {
    const suffix = variantId.replace(/-/g, '').slice(0, 8);
    slug = `${slug}-${suffix}`;
  }
  return slug;
}

export type BuildResearchTopicBlogDraftResult =
  | { ok: true; input: CreateBlogDraftInput }
  | { ok: false; error: string; code: 'missing_topic_title' | 'invalid_output' | 'empty_body' | 'invalid_slug' };

export function buildResearchTopicBlogDraftInput(args: {
  requestId: string;
  output: unknown;
  variantId?: string | null;
}): BuildResearchTopicBlogDraftResult {
  const parsed = researchTopicBriefOutputSchema.safeParse(args.output);
  if (!parsed.success) {
    return { ok: false, error: 'Brief-innholdet kan ikke leses', code: 'invalid_output' };
  }

  const topicTitle = parsed.data.topic_title?.trim();
  if (!topicTitle) {
    return { ok: false, error: 'Briefen mangler tittel', code: 'missing_topic_title' };
  }

  const title = normalizeBlogTitle(topicTitle);
  const body_md = buildBodyMarkdown(parsed.data);
  if (!body_md.trim()) {
    return { ok: false, error: 'Brief har ikke nok innhold til bloggutkast', code: 'empty_body' };
  }

  const slug = topicBlogSlugFromTitle(title, args.variantId);
  if (!isValidBlogSlug(slug)) {
    return {
      ok: false,
      error: 'Kunne ikke lage gyldig nettadresse fra brief-tittelen',
      code: 'invalid_slug',
    };
  }

  const publishableSources = filterPublishableSources(parseTopicBriefSources(parsed.data.sources));
  const suggested_tags = publishableSources
    .map((s) => s.publisher?.trim())
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 8);

  return {
    ok: true,
    input: {
      slug,
      title,
      excerpt: pickExcerpt(body_md, title),
      body_md,
      category: 'forklart',
      source_event: researchTopicBlogSourceEvent(args.requestId, args.variantId),
      review_note: 'Fra tema-brief i Research. Kun utkast — ingenting publiseres automatisk.',
      suggested_tags,
      ai: {
        model_family: 'research-topic-brief',
        prompt_version: 'topic-blog-v1',
        generated_at: parsed.data.generated_at ?? new Date().toISOString(),
      },
    },
  };
}
