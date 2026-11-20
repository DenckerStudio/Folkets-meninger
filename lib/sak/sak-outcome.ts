import type { SakTreatmentStatus } from '@/lib/sak-status';
import { getSakTreatmentLabel } from '@/lib/sak-status';

export type SakOutcomeKind = 'adopted' | 'rejected' | 'pending' | 'unknown';

export type SakOutcome = {
  kind: SakOutcomeKind;
  /** «Vedtatt» / «Ikke vedtatt» / «Under behandling»; `null` når utfallet ikke går fram av Stortingets tekst. */
  label: string | null;
  /** Stortingets egen setning som sier utfallet, f.eks. «Forslaget ble ikke vedtatt.» */
  sentence: string | null;
};

const REJECTED_RE =
  /\bikke\s+(?:ble\s+)?(?:vedtatt|bifalt)\b|\b(?:ble|blir|er)\s+(?:ikke\s+)?(?:avvist|forkastet)\b|\bvedtok\s+ikke\b|\bikke\s+(?:har\s+)?vedtatt\b/i;
const ADOPTED_RE = /\b(?:ble|blir|er)\s+(?:enstemmig\s+)?(?:vedtatt|bifalt)\b|\bStortinget\s+(?:har\s+)?vedtatt\b|\bvedtok\b|\bsamtykket\s+til\b/i;

function splitSentences(text: string): string[] {
  return text
    .split(/\r?\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function classifySentence(sentence: string): 'rejected' | 'adopted' | null {
  if (REJECTED_RE.test(sentence)) return 'rejected';
  if (ADOPTED_RE.test(sentence)) return 'adopted';
  return null;
}

/**
 * Utfall av en sak, utledet kun av det Stortinget selv skriver (kortvedtak, deretter vedtakstekst).
 * Blandede utfall (noe vedtatt, noe ikke) og tekst uten utfall gir `unknown` – vi gjetter ikke.
 */
export function deriveSakOutcome(input: {
  status: SakTreatmentStatus;
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
}): SakOutcome {
  if (input.status === 'pending') {
    return { kind: 'pending', label: getSakTreatmentLabel('pending'), sentence: null };
  }

  for (const source of [input.kortvedtak, input.vedtakstekst]) {
    const text = source?.trim();
    if (!text) continue;

    const rejected: string[] = [];
    const adopted: string[] = [];
    for (const sentence of splitSentences(text)) {
      const kind = classifySentence(sentence);
      if (kind === 'rejected') rejected.push(sentence);
      if (kind === 'adopted') adopted.push(sentence);
    }

    if (rejected.length > 0 && adopted.length === 0) {
      return { kind: 'rejected', label: 'Ikke vedtatt', sentence: rejected[0] };
    }
    if (adopted.length > 0 && rejected.length === 0) {
      return { kind: 'adopted', label: 'Vedtatt', sentence: adopted[0] };
    }
    if (adopted.length > 0 && rejected.length > 0) {
      return { kind: 'unknown', label: null, sentence: null };
    }
  }

  return { kind: 'unknown', label: null, sentence: null };
}

/** Kort status til lister: utfall når det er kjent, ellers behandlingsstatus. */
export function sakStatusOrOutcomeLabel(input: {
  status: SakTreatmentStatus;
  kortvedtak?: string | null;
  vedtakstekst?: string | null;
}): string {
  return deriveSakOutcome(input).label ?? getSakTreatmentLabel(input.status);
}
