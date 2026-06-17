import type { StortingetSakDetail } from './stortinget';

/** Saksgang-hendelser som markerer at Stortinget snart / har tatt stilling. */
const VOTE_CLOSE_EVENT_IDS = new Set([
  'PLBEHS',
  'VOT',
  'VOTLOV1',
  'BEH1LOV',
  'BEH2LOV',
  'BEHS',
  'VEDTAK',
]);

export type SakVotingWindow = {
  isOpen: boolean;
  closesAt: Date | null;
  daysLeft: number | null;
};

export function parseSaksgangEventDate(raw: string | null | undefined): Date | null {
  if (!raw || raw.startsWith('01.01.0001')) return null;

  const dotMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const year = Number(dotMatch[3]);
    const date = new Date(year, month - 1, day, 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dotnetMatch = raw.match(/\/Date\((\d+)[+-]\d+\)\//);
  if (dotnetMatch?.[1]) {
    const date = new Date(parseInt(dotnetMatch[1], 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getNextVoteCloseDate(detail: StortingetSakDetail | null | undefined): Date | null {
  if (!detail?.saksgang?.saksgang_steg_liste) return null;

  const now = Date.now();
  let closest: Date | null = null;

  for (const step of detail.saksgang.saksgang_steg_liste) {
    for (const event of step.saksgang_hendelse_liste ?? []) {
      if (!event.id || !VOTE_CLOSE_EVENT_IDS.has(event.id)) continue;
      const date = parseSaksgangEventDate(event.dato);
      if (!date || date.getTime() < now) continue;
      if (!closest || date.getTime() < closest.getTime()) {
        closest = date;
      }
    }
  }

  return closest;
}

export function getSakVotingWindow(
  detail: StortingetSakDetail | null | undefined,
  opts?: { now?: Date; ferdigbehandlet?: boolean | null },
): SakVotingWindow {
  const now = opts?.now ?? new Date();
  const ferdigbehandlet = opts?.ferdigbehandlet ?? detail?.ferdigbehandlet;

  if (ferdigbehandlet === true) {
    return { isOpen: false, closesAt: now, daysLeft: 0 };
  }

  const closesAt = getNextVoteCloseDate(detail);
  if (!closesAt) {
    return { isOpen: true, closesAt: null, daysLeft: null };
  }

  if (closesAt.getTime() <= now.getTime()) {
    return { isOpen: false, closesAt, daysLeft: 0 };
  }

  const daysLeft = Math.max(1, Math.ceil((closesAt.getTime() - now.getTime()) / 86_400_000));
  return { isOpen: true, closesAt, daysLeft };
}

export function formatVotingDaysLeftLabel(daysLeft: number | null): string | null {
  if (daysLeft == null || daysLeft <= 0) return null;
  if (daysLeft === 1) return '1 dag igjen å stemme';
  return `${daysLeft} dager igjen å stemme`;
}
