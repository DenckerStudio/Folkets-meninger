import { parsePromptSources, type PromptSourceHeadline } from '@/lib/forum/prompt-source';
import {
  isReelVoteOptionId,
  REEL_VOTE_OPTION_IDS,
} from '@/lib/forum/prompt-vote-options';

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type SourceValidationResult =
  | { ok: true; sources: PromptSourceHeadline[] }
  | { ok: false; error: string };

export function validatePromptVoteOptions(options: unknown): ValidationResult {
  if (!Array.isArray(options) || options.length === 0) {
    return { ok: false, error: 'Stemmevalg må være en liste med minst ett alternativ' };
  }

  for (const item of options) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Ugyldig stemmevalg' };
    }
    const row = item as Record<string, unknown>;
    const id = String(row.id ?? '').trim();
    const label = String(row.label ?? '').trim();
    if (!id || !label) {
      return { ok: false, error: 'Hvert stemmevalg må ha id og etikett' };
    }
    if (!isReelVoteOptionId(id)) {
      return {
        ok: false,
        error: `Ugyldig stemmevalg «${id}». Tillatte: ${REEL_VOTE_OPTION_IDS.join(', ')}`,
      };
    }
  }

  return { ok: true };
}

/** Validates admin/API payload; same rules as parsePromptSources with Norwegian errors. */
export function validatePromptSourceHeadlines(raw: unknown): SourceValidationResult {
  if (raw === undefined || raw === null) {
    return { ok: true, sources: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Kilder må være en liste' };
  }

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Hver kilde må være et objekt med tittel, URL og avis' };
    }
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    const url = String(row.url ?? row.link ?? '').trim();
    const outlet = String(row.outlet ?? '').trim();
    if (!title && !url && !outlet) continue;
    if (!title || !url) {
      return { ok: false, error: 'Hver kilde må ha både tittel og URL' };
    }
  }

  const sources = parsePromptSources(raw);
  if (raw.length > 0 && sources.length === 0) {
    return { ok: false, error: 'Kilder må ha tittel og URL for hver rad' };
  }

  return { ok: true, sources };
}

export function isActivePromptUniqueViolation(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = String(error.message ?? '').toLowerCase();
  return msg.includes('forum_prompts_active_question_unique');
}
