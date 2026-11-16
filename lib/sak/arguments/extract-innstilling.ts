import { createHash } from 'crypto';
import type { SakArgumentItem } from '@/lib/sak/arguments/types';

const FOR_SIGNAL_RE =
  /\b(tilrår|innstiller på|støtter|anbefaler|vedtas|bør vedtas|foreslår å vedta)\b/i;
const MOT_SIGNAL_RE =
  /\b(ikke tilrår|avviser|uenig\w*|motsetter seg|bør ikke vedtas|avvise|nedstem)\b/i;

const LIST_LINE_RE = /^(?:[-•*]|\d+[.)])\s+(.+)$/;

function stableId(prefix: string, text: string): string {
  return `${prefix}-${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

function sentenceChunks(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => {
      const listMatch = line.trim().match(LIST_LINE_RE);
      if (listMatch?.[1]) return [listMatch[1].trim()];
      return line
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 40);
    })
    .filter(Boolean);
}

export function extractInnstillingArguments(innstillingstekst: string | null | undefined): SakArgumentItem[] {
  const raw = innstillingstekst?.trim();
  if (!raw) return [];

  const items: SakArgumentItem[] = [];
  for (const sentence of sentenceChunks(raw)) {
    let side: SakArgumentItem['side'] | null = null;
    if (MOT_SIGNAL_RE.test(sentence)) side = 'mot';
    else if (FOR_SIGNAL_RE.test(sentence)) side = 'for';
    if (!side) continue;

    items.push({
      id: stableId('innst', sentence),
      side,
      text: sentence.replace(/\s+/g, ' '),
      source: {
        kind: 'innstilling',
        label: 'Komiteens innstilling (Stortinget)',
        anchorId: 'sak-innstilling',
      },
    });
  }

  return items.slice(0, 8);
}