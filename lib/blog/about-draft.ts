import { z } from 'zod';
import { pickBlogExcerptFromBody } from '@/lib/admin/research/topic-blog-draft-body';
import {
  generateWithAnswerLlm,
  isAnswerLlmConfigured,
  isAnswerLlmTimeoutError,
  resolveBlogDraftAnswerLlmTimeoutMs,
} from '@/lib/blog/answer-llm';
import { sanitizeBlogDraftBodyMarkdown } from '@/lib/blog/blog-draft-body';
import type { CreateBlogDraftInput } from '@/lib/blog/service';
import { isValidBlogSlug, normalizeBlogSlug } from '@/lib/blog/slug';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX, normalizeBlogTitle } from '@/lib/blog/text-limits';
import {
  cmsBlogOpsListBySourceEventPrefix,
  type BlogOpsListedDraft,
} from '@/lib/cms/blog-ops-client';
import {
  OM_FAQ,
  OM_FREE_FEATURES,
  OM_INTRO,
  OM_PROCESS_STEPS,
  OM_STEMME_PLUS_FEATURES,
  OM_WHY_POINTS,
} from '@/lib/landing/om-content';

/** Payload category seeded in `cms/src/seed/seedBaseData.ts`. */
export const ABOUT_BLOG_CATEGORY_SLUG = 'om-folkets-meninger';
export const ABOUT_BLOG_SOURCE_PREFIX = 'about:';
export const ABOUT_BLOG_PROMPT_VERSION = 'about-v1';
export const ABOUT_BLOG_TITLE_MIN = 3;
export const ABOUT_BLOG_ANGLE_MAX = 600;

const ABOUT_BLOG_SLUG_BASE_MAX = 100;

const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}])';
const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}])';

/** Names that must stay out of about-posts (see AGENTS.md «Never do this»). */
const FORBIDDEN_ABOUT_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'BankID', pattern: new RegExp(`${NOT_WORD_BEFORE}bank[\\s-]?id${NOT_WORD_AFTER}`, 'iu') },
  { label: 'MinID', pattern: new RegExp(`${NOT_WORD_BEFORE}min-?id${NOT_WORD_AFTER}`, 'iu') },
  // Case-sensitive: «folkets stemmer» (the votes) is ordinary prose, the old brand name is not.
  { label: 'Folkets Stemme', pattern: new RegExp(`Folkets[\\s-]+Stemme${NOT_WORD_AFTER}`, 'u') },
  { label: 'folkets-stemme.no', pattern: /folkets-?stemme\.no/iu },
  { label: 'Reddit', pattern: new RegExp(`${NOT_WORD_BEFORE}reddit${NOT_WORD_AFTER}`, 'iu') },
];

export function findForbiddenAboutTerms(text: string): string[] {
  return FORBIDDEN_ABOUT_TERMS.filter((term) => term.pattern.test(text)).map((term) => term.label);
}

/** Vetted public copy from the landing page — the only facts the model may build on. */
export function aboutBlogProductFacts(): string[] {
  return [
    OM_INTRO,
    ...OM_WHY_POINTS.map((point) => `${point.title}: ${point.body}`),
    ...OM_PROCESS_STEPS.map((step) => `${step.title}: ${step.body}`),
    ...OM_FAQ.map((entry) => `${entry.question} ${entry.answer}`),
    `Gratis for alle: ${OM_FREE_FEATURES.join('; ')}.`,
    `Stemme+ gir: ${OM_STEMME_PLUS_FEATURES.join('; ')}.`,
  ];
}

export function buildAboutBlogPrompt(args: { title: string; angle?: string | null }): string {
  const angle = args.angle?.trim();
  const facts = aboutBlogProductFacts().map((fact) => `- ${fact}`);

  return `Du er redaksjonell skribent for Folkets Meninger. Skriv et bloggutkast på norsk bokmål til kategorien «Om Folkets Meninger»: innlegg om selve tjenesten, hva den er, hvordan den virker og hvorfor den finnes.

Tittel: ${args.title}
Vinkling fra redaksjonen: ${angle || 'Ingen vinkling oppgitt. Ta utgangspunkt i tittelen.'}

Fakta om tjenesten (eneste tillatte faktagrunnlag):
${facts.join('\n')}

Regler:
- Bygg kun på faktaene over. Ikke finn opp tall, brukerantall, datoer, sitater, navngitte personer, samarbeidspartnere eller funksjoner.
- Ikke lov noe om framtidige funksjoner.
- Tjenesten heter «Folkets Meninger». Ikke bruk «Folkets Stemme» eller folkets-stemme.no.
- Ikke nevn BankID, MinID eller Reddit.
- Avstemninger har bare valgene Ja, Nei og Blank.
- Skriv saklig og konkret i vi-form, uten reklamespråk. Omtrent 300–450 ord.
- Bruk markdown med ##-overskrifter der det passer. Ikke gjenta tittelen, ikke bruk #-overskrift, og ta ikke med kildeliste eller fotnoter.

Svar kun med brødtekst i markdown.`;
}

const aboutDraftRequestSchema = z.object({
  title: z
    .string({ error: 'Tittel mangler' })
    .trim()
    .min(ABOUT_BLOG_TITLE_MIN, `Tittelen må ha minst ${ABOUT_BLOG_TITLE_MIN} tegn`)
    .max(BLOG_TITLE_MAX, `Tittelen kan ha maks ${BLOG_TITLE_MAX} tegn`),
  angle: z
    .string({ error: 'Vinklingen må være tekst' })
    .trim()
    .max(ABOUT_BLOG_ANGLE_MAX, `Vinklingen kan ha maks ${ABOUT_BLOG_ANGLE_MAX} tegn`)
    .optional(),
  request_id: z.uuid('request_id må være en gyldig UUID').optional(),
});

export type AboutDraftRequest = {
  title: string;
  angle: string | null;
  requestId: string | null;
};

export type ParseAboutDraftRequestResult =
  | { ok: true; value: AboutDraftRequest }
  | { ok: false; message: string };

export function parseAboutDraftRequest(body: unknown): ParseAboutDraftRequestResult {
  const parsed = aboutDraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Root-level issues (body is not an object) carry zod's English default message.
    const message = issue && issue.path.length > 0 ? issue.message : 'Ugyldig forespørsel';
    return { ok: false, message };
  }

  const title = normalizeBlogTitle(parsed.data.title);
  const angle = parsed.data.angle || null;
  const forbidden = findForbiddenAboutTerms(`${title}\n${angle ?? ''}`);
  if (forbidden.length > 0) {
    return {
      ok: false,
      message: `Tittel og vinkling kan ikke inneholde: ${forbidden.join(', ')}.`,
    };
  }

  return {
    ok: true,
    value: { title, angle, requestId: parsed.data.request_id?.toLowerCase() ?? null },
  };
}

export function aboutBlogSourceEvent(requestId: string): string {
  return `${ABOUT_BLOG_SOURCE_PREFIX}${requestId.trim()}`;
}

/** Slug from the title; `uniqueSuffixFrom` adds a short id when the plain slug is taken. */
export function aboutBlogSlug(title: string, uniqueSuffixFrom?: string | null): string {
  const base = normalizeBlogSlug(title).slice(0, ABOUT_BLOG_SLUG_BASE_MAX).replace(/-+$/, '');
  const suffix = uniqueSuffixFrom?.replace(/-/g, '').slice(0, 8);
  return suffix ? `${base}-${suffix}` : base;
}

function cleanAboutBody(raw: string): string {
  const withoutTitleHeading = raw.trim().replace(/^#\s+[^\n]*\n+/, '');
  return sanitizeBlogDraftBodyMarkdown(withoutTitleHeading);
}

const ABOUT_EXCERPT_MIN_SENTENCE = 80;

/** Ingress from the opening paragraph, ended at a sentence or word instead of mid-word. */
export function aboutBlogExcerpt(bodyMarkdown: string, title: string): string {
  const firstParagraph =
    bodyMarkdown.split(/\n{2,}/).find((block) => block.trim() && !block.trimStart().startsWith('#')) ??
    '';
  const plain = pickBlogExcerptFromBody(firstParagraph, title);
  if (plain.length < BLOG_EXCERPT_MAX) return plain;

  const sentenceEnd = Math.max(
    plain.lastIndexOf('. '),
    plain.lastIndexOf('! '),
    plain.lastIndexOf('? '),
  );
  if (sentenceEnd >= ABOUT_EXCERPT_MIN_SENTENCE) return plain.slice(0, sentenceEnd + 1);

  const wordEnd = plain.lastIndexOf(' ');
  if (wordEnd <= 0) return plain;
  return `${plain.slice(0, wordEnd).replace(/[\s,;:–-]+$/, '')}…`;
}

export type AboutBlogDraftErrorCode =
  | 'llm_unconfigured'
  | 'llm_timeout'
  | 'llm_error'
  | 'empty_body'
  | 'forbidden_terms'
  | 'invalid_slug';

export type BuildAboutBlogDraftResult =
  | { ok: true; input: CreateBlogDraftInput }
  | { ok: false; code: AboutBlogDraftErrorCode; error: string };

export async function buildAboutBlogDraftInput(args: {
  title: string;
  angle?: string | null;
  requestId: string;
  slug: string;
  fetchImpl?: typeof fetch;
}): Promise<BuildAboutBlogDraftResult> {
  if (!isValidBlogSlug(args.slug)) {
    return {
      ok: false,
      code: 'invalid_slug',
      error: 'Kunne ikke lage gyldig nettadresse fra tittelen',
    };
  }
  if (!isAnswerLlmConfigured()) {
    return {
      ok: false,
      code: 'llm_unconfigured',
      error: 'Tekstgenerering er ikke satt opp på app-serveren (ANSWER_LLM_URL og ANSWER_LLM_MODEL).',
    };
  }

  let body_md: string;
  try {
    const raw = await generateWithAnswerLlm(buildAboutBlogPrompt(args), {
      fetchImpl: args.fetchImpl,
      timeoutMs: resolveBlogDraftAnswerLlmTimeoutMs(),
    });
    body_md = cleanAboutBody(raw);
  } catch (error) {
    if (isAnswerLlmTimeoutError(error)) {
      return {
        ok: false,
        code: 'llm_timeout',
        error: 'Tekstgenerering tok for lang tid (over 110 s). Prøv igjen senere.',
      };
    }
    console.error('[blog] ANSWER_LLM generering av om-utkast feilet', error);
    return { ok: false, code: 'llm_error', error: 'Tekstgenerering feilet. Prøv igjen senere.' };
  }

  if (!body_md) {
    return { ok: false, code: 'empty_body', error: 'Tekstgenereringen ga ingen brødtekst. Prøv igjen.' };
  }

  const forbidden = findForbiddenAboutTerms(body_md);
  if (forbidden.length > 0) {
    return {
      ok: false,
      code: 'forbidden_terms',
      error: `Utkastet nevnte uttrykk vi ikke bruker (${forbidden.join(', ')}) og ble ikke lagret. Prøv igjen, eller juster vinklingen.`,
    };
  }

  const angle = args.angle?.trim();
  const reviewNote = [
    'Laget fra admin-huben til «Om Folkets Meninger». Kun utkast, ingenting publiseres automatisk.',
    angle ? `Vinkling: ${angle}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ok: true,
    input: {
      slug: args.slug,
      title: args.title,
      excerpt: aboutBlogExcerpt(body_md, args.title),
      body_md,
      category: ABOUT_BLOG_CATEGORY_SLUG,
      source_event: aboutBlogSourceEvent(args.requestId),
      review_note: reviewNote,
      ai: {
        model_family: 'answer-llm',
        prompt_version: ABOUT_BLOG_PROMPT_VERSION,
        generated_at: new Date().toISOString(),
      },
    },
  };
}

export async function listAboutBlogDrafts(): Promise<{
  drafts: BlogOpsListedDraft[];
  lookupFailed: boolean;
}> {
  const listed = await cmsBlogOpsListBySourceEventPrefix(ABOUT_BLOG_SOURCE_PREFIX);
  if (listed === null) {
    return { drafts: [], lookupFailed: true };
  }
  return { drafts: listed, lookupFailed: false };
}
