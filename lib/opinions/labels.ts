import type { OpinionStance, OpinionStanceCounts } from './types';

export const FLAG_BLUE = '#00205B';
export const FLAG_RED = '#BA0C2F';
export const FLAG_WHITE = '#FFFFFF';

export type StanceVisual = {
  label: string;
  bg: string;
  fg: string;
  ring: string;
};

export const STANCE_VISUAL: Record<OpinionStance, StanceVisual> = {
  for: { label: 'For', bg: FLAG_BLUE, fg: FLAG_WHITE, ring: FLAG_BLUE },
  blank: { label: 'Blank', bg: FLAG_WHITE, fg: FLAG_BLUE, ring: 'rgba(0,32,91,0.25)' },
  imot: { label: 'Imot', bg: FLAG_RED, fg: FLAG_WHITE, ring: FLAG_RED },
};

export function stanceLabel(stance: OpinionStance): string {
  switch (stance) {
    case 'for':
      return STANCE_VISUAL.for.label;
    case 'blank':
      return STANCE_VISUAL.blank.label;
    case 'imot':
      return STANCE_VISUAL.imot.label;
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
}

export function emptyStanceCounts(): OpinionStanceCounts {
  return { for: 0, blank: 0, imot: 0, total: 0 };
}

export function addStanceCount(counts: OpinionStanceCounts, stance: OpinionStance, amount = 1): void {
  switch (stance) {
    case 'for':
      counts.for += amount;
      break;
    case 'blank':
      counts.blank += amount;
      break;
    case 'imot':
      counts.imot += amount;
      break;
    default: {
      const _exhaustive: never = stance;
      return _exhaustive;
    }
  }
  counts.total += amount;
}

export function formatOpinionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
