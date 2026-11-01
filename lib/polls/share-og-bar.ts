import type { PollTotals } from '@/lib/polls/types';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';

/** Below this total, OG cards avoid a proportional bar that implies a stable majority. */
export const POLL_OG_BAR_MIN_TOTAL = 10;

export type PollOgBarSegment = {
  choice: (typeof POLL_BALLOT_CHOICES)[number];
  label: string;
  count: number;
  /** 0–100 share of total votes (0 when total is 0). */
  percent: number;
  background: string;
  color: string;
};

const SEGMENT_STYLE: Record<(typeof POLL_BALLOT_CHOICES)[number], { background: string; color: string }> = {
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

function formatPercentShare(percent: number): string {
  return `${Math.round(percent)} %`;
}

/** One results line: Nei/Blank/Ja shares plus status (Nei → Blank → Ja). */
export function formatPollOgResultsLine(totals: PollTotals): string {
  const segments = buildPollOgBarSegments(totals);
  if (totals.total <= 0) {
    const zeros = segments.map((segment) => `${segment.label} 0 %`).join(' · ');
    return `${zeros} — Bli den første til å stemme`;
  }
  if (totals.total < POLL_OG_BAR_MIN_TOTAL) {
    const counts = segments.map((segment) => `${segment.label} ${segment.count}`).join(' · ');
    return `${counts} — Få stemmer så langt`;
  }
  const shares = segments.map((segment) => `${segment.label} ${formatPercentShare(segment.percent)}`).join(' · ');
  const stemmer = totals.total === 1 ? '1 stemme' : `${totals.total} stemmer`;
  return `${shares} — ${stemmer}`;
}

/** Alt text for poll OG / metadata (percentages when enough votes). */
export function pollOgImageAltText(title: string, totals: PollTotals): string {
  const trimmed = title.trim();
  if (totals.total <= 0) {
    return `${trimmed} – ingen stemmer ennå`;
  }
  const segments = buildPollOgBarSegments(totals);
  if (totals.total < POLL_OG_BAR_MIN_TOTAL) {
    const counts = segments.map((segment) => `${segment.label} ${segment.count}`).join(', ');
    return `${trimmed} – ${counts}`;
  }
  const shares = segments.map((segment) => `${segment.label} ${formatPercentShare(segment.percent)}`).join(', ');
  return `${trimmed} – ${shares}`;
}
