import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';

/** Below this total, OG cards avoid a proportional bar that implies a stable majority. */
export const POLL_OG_BAR_MIN_TOTAL = 10;

export type PollOgBarSegment = {
  choice: PollChoice;
  label: string;
  count: number;
  /** 0–100 share of total votes (0 when total is 0). */
  percent: number;
  background: string;
  color: string;
};

const SEGMENT_STYLE: Record<PollChoice, { background: string; color: string }> = {
  nei: { background: '#ba0c2f', color: '#ffffff' },
  blank: { background: '#ffffff', color: '#00205b' },
  ja: { background: '#0a3d9e', color: '#ffffff' },
};

/** Nei → Blank → Ja bar segments for OG cards (testable without ImageResponse). */
export function buildPollOgBarSegments(totals: PollTotals): PollOgBarSegment[] {
  const total = Math.max(0, totals.total);
  return POLL_BALLOT_CHOICES.map((choice) => {
    const count = Math.max(0, totals[choice]);
    const style = SEGMENT_STYLE[choice];
    const percent = total > 0 ? (count / total) * 100 : 0;
    return {
      choice,
      label: pollChoiceLabel(choice),
      count,
      percent,
      ...style,
    };
  });
}

export function showPollOgProportionalBar(totals: PollTotals): boolean {
  return totals.total >= POLL_OG_BAR_MIN_TOTAL;
}

export function formatPollOgLegendLine(totals: PollTotals): string {
  const segments = buildPollOgBarSegments(totals);
  return segments.map((segment) => `${segment.label} ${segment.count}`).join(' · ');
}

/** Status line below the per-choice legend (total or small-sample honesty). */
export function formatPollOgTotalLine(totals: PollTotals): string {
  if (totals.total <= 0) return 'Bli den første til å stemme';
  if (totals.total < POLL_OG_BAR_MIN_TOTAL) return 'Få stemmer så langt';
  return totals.total === 1 ? '1 stemme' : `${totals.total} stemmer`;
}
