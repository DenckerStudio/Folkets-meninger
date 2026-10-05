import type { ChatSakContext } from '@/lib/chat/rag';
import { searchSearxng, type SearxngHit } from '@/lib/chat/searxng';

export const SPELLING_CONTEXTS = ['diskusjon', 'motforslag', 'horing', 'annet'] as const;
export type SpellingContext = (typeof SPELLING_CONTEXTS)[number];

export const RETTSSKRIVING_INSTRUCTION =
  'Rett stavemåte, grammatikk og tydelighet. Behold brukerens mening. Ikke finn på argumenter, sitater eller fakta. Ikke formuler et ferdig innlegg som om det var publisert.';

export const RETTSSKRIVING_DRAFT_MIN = 8;
export const RETTSSKRIVING_DRAFT_MAX = 8000;
export const SOURCE_QUERY_MIN = 3;
export const SAK_CONTEXT_QUERY_MIN = 2;

export type RettsskrivingMode = 'instruction' | 'corrected';

type RettsskrivingBase = {
  original: string;
  context: SpellingContext;
  instruction: string;
  published: false;
};

export type RettsskrivingResult =
  | (RettsskrivingBase & {
      mode: 'instruction';
      corrected: null;
      notes: null;
    })
  | (RettsskrivingBase & {
      mode: 'corrected';
      corrected: string;
      notes: string | null;
    });

export type SourceSearchResult =
  | { ok: true; unavailable: false; results: SearxngHit[] }
  | { ok: false; unavailable: true; error: string; results: [] }
  | { ok: false; unavailable: false; error: string; results: [] };

export type SakContextActionResult = ChatSakContext & { empty: boolean };

export function isSpellingContext(value: string): value is SpellingContext {
  return (SPELLING_CONTEXTS as readonly string[]).includes(value);
}

export function spellingContextLabel(context: SpellingContext): string {
  switch (context) {
    case 'diskusjon':
      return 'Sak-diskusjon';
    case 'motforslag':
      return 'Motforslag';
    case 'horing':
      return 'Høringsinnspill';
    case 'annet':
      return 'Annet';
    default: {
      const _never: never = context;
      return _never;
    }
  }
}

/** Instruction-only payload — does not publish UGC or invent a correction. */
export function runRettsskriving(input: {
  draft: string;
  context: SpellingContext;
}): { ok: true; result: RettsskrivingResult } | { ok: false; error: string } {
  const draft = input.draft.trim();
  if (draft.length < RETTSSKRIVING_DRAFT_MIN) {
    return { ok: false, error: `Kladden må være minst ${RETTSSKRIVING_DRAFT_MIN} tegn.` };
  }
  if (draft.length > RETTSSKRIVING_DRAFT_MAX) {
    return { ok: false, error: `Kladden kan være maks ${RETTSSKRIVING_DRAFT_MAX} tegn.` };
  }

  return {
    ok: true,
    result: {
      original: draft,
      context: input.context,
      instruction: RETTSSKRIVING_INSTRUCTION,
      published: false,
      mode: 'instruction',
      corrected: null,
      notes: null,
    },
  };
}

/** Same path as `searchUpdatedSources` / SearXNG — honest empty or unavailable. */
export async function runUpdatedSourceSearch(query: string): Promise<SourceSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < SOURCE_QUERY_MIN) {
    return {
      ok: false,
      unavailable: false,
      error: `Søkestrengen må være minst ${SOURCE_QUERY_MIN} tegn.`,
      results: [],
    };
  }

  const result = await searchSearxng(trimmed);
  if (!result.ok) {
    return { ok: false, unavailable: true, error: result.error, results: [] };
  }

  return { ok: true, unavailable: false, results: result.results };
}

export function isSakContextEmpty(context: Pick<ChatSakContext, 'issue' | 'summary' | 'chunks'>): boolean {
  return !context.issue || (!context.summary && context.chunks.length === 0);
}

export function parseSakContextInput(input: {
  issueId?: string | null;
  query?: string | null;
}): { ok: true; issueId: string | null; query: string } | { ok: false; error: string } {
  const issueId = input.issueId?.trim() || null;
  const query = input.query?.trim() || '';
  if (!issueId && query.length < SAK_CONTEXT_QUERY_MIN) {
    return {
      ok: false,
      error: `Skriv inn sak-id eller minst ${SAK_CONTEXT_QUERY_MIN} tegn av tittelen.`,
    };
  }
  return { ok: true, issueId, query: query || issueId || '' };
}
