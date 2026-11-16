import {
  researchTopicBriefOutputSchema,
  type ResearchTopicBriefOutput,
} from '@/lib/admin/research/topic-brief-schema';
import {
  generateWithAnswerLlm,
  isAnswerLlmConfigured,
  isAnswerLlmTimeoutError,
  resolveBlogDraftAnswerLlmTimeoutMs,
} from '@/lib/blog/answer-llm';
import { sanitizeBlogDraftBodyMarkdown } from '@/lib/blog/blog-draft-body';
import {
  blogDraftSourcesToCms,
  collectBlogDraftSources,
  type BlogDraftSource,
} from '@/lib/blog/blog-draft-sources';
import type { CreateBlogDraftInput } from '@/lib/blog/service';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import { normalizeBlogExcerpt, normalizeBlogTitle } from '@/lib/blog/text-limits';
import {
  researchTopicBlogSourceEvent,
} from '@/lib/admin/research/topic-blog-draft';
import {
  buildBriefBodyMarkdownFromOutput,
  pickBlogExcerptFromBody,
  topicBlogSlugFromTitle,
} from '@/lib/admin/research/topic-blog-draft-body';

export type BuildResearchTopicBlogDraftResult =
  | { ok: true; input: CreateBlogDraftInput; sourcesUsed: BlogDraftSource[] }
  | {
      ok: false;
      error: string;
      code:
        | 'missing_topic_title'
        | 'invalid_output'
        | 'empty_body'
        | 'invalid_slug'
        | 'llm_timeout'
        | 'llm_error'
        | 'search_error';
    };

function buildLlmPrompt(args: {
  title: string;
  brief: ResearchTopicBriefOutput;
  sources: readonly BlogDraftSource[];
}): string {
  const sourceLines = args.sources.map((source, index) => {
    const snippet = source.snippet ? ` Utdrag: ${source.snippet.slice(0, 280)}` : '';
    return `[${index + 1}] ${source.title} (${source.publisher}) — ${source.url}.${snippet}`;
  });

  return `Du er redaksjonell skribent for Folkets Meninger. Skriv et forklarende bloggutkast på norsk bokmål.
Bruk KUN oppgitte kilder. Sett kildehenvisninger i teksten som [1], [2] osv. som matcher kildelisten — ikke GFM-fotnoter.
Ikke nevn Reddit, ikke nevn research_topics.title, og ikke finn opp kilder.

Tittel: ${args.title}

Kilder (nummerert):
${sourceLines.join('\n')}

Brief-struktur (fakta du kan bygge på — ikke kopier altordrett uten kildehenvisning):
${JSON.stringify(
    {
      current_rules: args.brief.current_rules,
      party_proposals: args.brief.party_proposals,
      media_coverage: args.brief.media_coverage,
      polls: args.brief.polls,
    },
    null,
    2,
  )}

Skriv markdown med overskrifter (##) der det passer. Inkluder IKKE en "## Kilder"-seksjon i svaret.
Svar kun med brødtekst-markdown.`;
}

async function generateBlogBodyWithLlm(args: {
  title: string;
  brief: ResearchTopicBriefOutput;
  sources: readonly BlogDraftSource[];
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!isAnswerLlmConfigured() || args.sources.length === 0) return null;
  try {
    const prompt = buildLlmPrompt(args);
    const raw = await generateWithAnswerLlm(prompt, {
      fetchImpl: args.fetchImpl,
      timeoutMs: resolveBlogDraftAnswerLlmTimeoutMs(),
    });
    return sanitizeBlogDraftBodyMarkdown(raw);
  } catch (error) {
    if (isAnswerLlmTimeoutError(error)) {
      throw error;
    }
    console.error('[blog] ANSWER_LLM generering feilet', error);
    return null;
  }
}

export async function buildResearchTopicBlogDraftWithSources(args: {
  requestId: string;
  topicId: string;
  output: unknown;
  variantId?: string | null;
  fetchImpl?: typeof fetch;
  /** Ved `fail`: ikke fall tilbake til brief når LLM feiler (ops/cron). */
  llmOnFailure?: 'fallback' | 'fail';
  /** Ved true: avbryt når konfigurert nettsøk feiler (ops/cron). */
  failOnSearchError?: boolean;
}): Promise<BuildResearchTopicBlogDraftResult> {
  const parsed = researchTopicBriefOutputSchema.safeParse(args.output);
  if (!parsed.success) {
    return { ok: false, error: 'Brief-innholdet kan ikke leses', code: 'invalid_output' };
  }

  const topicTitle = parsed.data.topic_title?.trim();
  if (!topicTitle) {
    return { ok: false, error: 'Briefen mangler tittel', code: 'missing_topic_title' };
  }

  const title = normalizeBlogTitle(topicTitle);
  const collected = await collectBlogDraftSources(
    { kind: 'topic', topicId: args.topicId },
    { briefOutput: args.output, fetchImpl: args.fetchImpl },
  );
  if (args.failOnSearchError && collected.webSearchFailed) {
    return {
      ok: false,
      error: 'Kildesøk feilet. Prøv igjen senere.',
      code: 'search_error',
    };
  }
  const sources = collected.sources;

  let llmBody: string | null = null;
  try {
    llmBody = await generateBlogBodyWithLlm({
      title,
      brief: parsed.data,
      sources,
      fetchImpl: args.fetchImpl,
    });
  } catch (error) {
    if (isAnswerLlmTimeoutError(error)) {
      return {
        ok: false,
        error: 'Tekstgenerering tok for lang tid (over 110 s). Prøv igjen uten LLM eller senere.',
        code: 'llm_timeout',
      };
    }
    throw error;
  }

  if (
    args.llmOnFailure === 'fail' &&
    isAnswerLlmConfigured() &&
    sources.length > 0 &&
    !llmBody
  ) {
    return {
      ok: false,
      error: 'Tekstgenerering feilet. Prøv igjen senere.',
      code: 'llm_error',
    };
  }

  const includeBriefSources = sources.length === 0;
  let body_md =
    llmBody ?? buildBriefBodyMarkdownFromOutput(parsed.data, includeBriefSources);
  body_md = sanitizeBlogDraftBodyMarkdown(body_md);

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

  const suggested_tags = sources
    .map((s) => s.publisher.trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    ok: true,
    sourcesUsed: sources,
    input: {
      slug,
      title,
      excerpt: pickBlogExcerptFromBody(body_md, title),
      body_md,
      category: 'forklart',
      source_event: researchTopicBlogSourceEvent(args.requestId, args.variantId),
      review_note: 'Fra tema-brief i Research. Kun utkast — ingenting publiseres automatisk.',
      suggested_tags,
      sources: blogDraftSourcesToCms(sources),
      ai: {
        model_family: isAnswerLlmConfigured() ? 'answer-llm' : 'research-topic-brief',
        prompt_version: 'topic-blog-multi-source-v1',
        generated_at: parsed.data.generated_at ?? new Date().toISOString(),
      },
    },
  };
}

export { mergeBlogDraftSources, adminSavedSourcesFromBriefOutput } from '@/lib/blog/blog-draft-sources';