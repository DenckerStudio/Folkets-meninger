import {
  filterPublishableSources,
  parseTopicBriefSources,
  researchTopicBriefOutputSchema,
} from '@/lib/admin/research/topic-brief-schema';
import {
  buildBriefBodyMarkdownFromOutput,
  pickBlogExcerptFromBody,
  topicBlogSlugFromTitle,
} from '@/lib/admin/research/topic-blog-draft-body';
import type { CreateBlogDraftInput } from '@/lib/blog/service';
import { isValidBlogSlug } from '@/lib/blog/slug';
import { normalizeBlogTitle } from '@/lib/blog/text-limits';
import { cmsBlogOpsListBySourceEventPrefix } from '@/lib/cms/blog-ops-client';

export { findMoreSources } from '@/lib/sources';

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
  const body_md = buildBriefBodyMarkdownFromOutput(parsed.data);
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
      excerpt: pickBlogExcerptFromBody(body_md, title),
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
