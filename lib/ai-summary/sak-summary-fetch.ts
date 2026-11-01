import {
  isAiSummaryV2,
  type AiSummary,
  type AiSummaryLegacy,
  type AiSummaryV2,
  type TopicCard,
} from '@/lib/ai-summary/types';

export type SakSummaryReady =
  | ({ version: 2 } & AiSummaryV2 & { cached?: boolean })
  | ({ version: 1 } & AiSummaryLegacy & { cached?: boolean });

export const SAK_SUMMARY_READ_FAILED_MESSAGE =
  'Vi fikk ikke hentet sammendraget akkurat nå. Prøv igjen om litt.';
export const SAK_SUMMARY_TIMEOUT_MESSAGE = 'Sammendraget er ikke klart ennå.';
export const SAK_SUMMARY_GENERATING_MESSAGE =
  'Genererer sammendrag (kan ta noen minutter) …';

export type SakSummaryFetchKind = 'ready' | 'pending' | 'read_failed' | 'unexpected';

export function parseReadySakSummary(json: Record<string, unknown>): SakSummaryReady | null {
  const narrative =
    typeof json.narrative === 'string' ? json.narrative.trim() : '';
  if (json.version === 2 && narrative) {
    return {
      version: 2,
      narrative,
      who_affected: String(json.who_affected ?? ''),
      how_affected: String(json.how_affected ?? ''),
      kostnad: typeof json.kostnad === 'string' ? json.kostnad : '',
      forslag: Array.isArray(json.forslag)
        ? json.forslag.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [],
      topic_cards: Array.isArray(json.topic_cards)
        ? (json.topic_cards as TopicCard[])
        : [],
      labels: Array.isArray(json.labels) ? (json.labels as string[]) : [],
      cached: json.cached === true,
    };
  }

  if (typeof json.hva === 'string') {
    return {
      version: 1,
      hva: json.hva,
      hvem: String(json.hvem ?? ''),
      kostnad: String(json.kostnad ?? ''),
      cached: json.cached === true,
    };
  }

  return null;
}

export function classifySakSummaryHttpResponse(
  status: number,
  json: Record<string, unknown>,
): SakSummaryFetchKind {
  if (status === 503 && json.status === 'read_failed') {
    return 'read_failed';
  }
  if (status === 202 || json.status === 'pending') {
    return 'pending';
  }
  return 'unexpected';
}

/** Stored row → the shape the sak dialog already renders. Review status is not an input. */
export function sakSummaryReadyFromStored(summary: AiSummary | null): SakSummaryReady | null {
  if (!summary) return null;
  if (isAiSummaryV2(summary)) {
    if (!summary.narrative.trim()) return null;
    return { ...summary, cached: true };
  }
  if (!summary.hva.trim()) return null;
  return { ...summary, cached: true };
}

/** Lead text shown on the sak page as soon as a summary row exists. */
export function publicSakSummaryLead(summary: AiSummary | null): string | null {
  const ready = sakSummaryReadyFromStored(summary);
  if (!ready) return null;
  switch (ready.version) {
    case 2:
      return ready.narrative.trim();
    case 1:
      return ready.hva.trim();
    default: {
      const unreachable: never = ready;
      return unreachable;
    }
  }
}

export function retryAfterSeconds(json: Record<string, unknown>, fallback = 15): number {
  return typeof json.retry_after_seconds === 'number' && json.retry_after_seconds > 0
    ? json.retry_after_seconds
    : fallback;
}
