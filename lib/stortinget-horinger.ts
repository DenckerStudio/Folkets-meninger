export type StortingetHoringSakInfo = {
  sak_id?: number;
  sak_tittel?: string;
  sak_korttittel?: string;
  sak_henvisning?: string;
  sak_publikasjon?: string;
};

export type StortingetHoringTidspunkt = {
  sted?: string;
  tidspunkt?: string;
};

export type StortingetHoring = {
  id: string;
  horing_status?: string;
  komite?: { navn?: string; id?: string };
  horing_sak_info_liste?: StortingetHoringSakInfo[];
  innspillsfrist?: string;
  anmodningsfrist_dato_tid?: string;
  soknadfrist_dato?: string;
  start_dato?: string;
  skriftlig?: boolean;
  status_info_tekst?: string;
  horingstidspunkt_liste?: StortingetHoringTidspunkt[];
};

/** .NET DateTime.MinValue used by Stortinget when no date is set. */
export const STORTINGET_MIN_DATE_MS = -62_135_596_800_000;

export type HoringStatusKind = 'open' | 'planned' | 'held' | 'cancelled';

function isPlausibleHoringYear(year: number): boolean {
  return year >= 1990 && year <= 2100;
}

export function parseStortingetDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;

  const dotnetMatch = raw.match(/\/Date\((-?\d+)(?:[+-]\d+)?\)\//);
  if (dotnetMatch) {
    const ms = Number.parseInt(dotnetMatch[1], 10);
    if (Number.isNaN(ms) || ms <= STORTINGET_MIN_DATE_MS) return null;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime()) || !isPlausibleHoringYear(date.getFullYear())) return null;
    return date;
  }

  if (/^01\.01\.0001/.test(raw.trim())) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime()) || !isPlausibleHoringYear(d.getFullYear())) return null;
  return d;
}

export function formatDateNb(date: Date): string {
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatStortingetDate(raw: string | undefined): string | null {
  const date = parseStortingetDate(raw);
  if (!date) return null;
  return formatDateNb(date);
}

export function formatStortingetDateTime(raw: string | undefined): string | null {
  const date = parseStortingetDate(raw);
  if (!date) return null;
  return date.toLocaleString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchStortingetHoringer(): Promise<StortingetHoring[]> {
  const res = await fetch('https://data.stortinget.no/eksport/horinger?format=json', {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error('Failed to fetch høringer');
  const data = await res.json();
  return (data.horinger_liste ?? []) as StortingetHoring[];
}

export async function fetchStortingetHoringById(id: string): Promise<StortingetHoring | null> {
  const list = await fetchStortingetHoringer();
  return list.find((h) => String(h.id) === String(id)) ?? null;
}

export function getHoringTitle(hearing: StortingetHoring): string {
  const sak = hearing.horing_sak_info_liste?.[0];
  return sak?.sak_tittel || sak?.sak_korttittel || 'Høring uten tittel';
}

export function getHoringSubtitle(hearing: StortingetHoring): string | null {
  const sak = hearing.horing_sak_info_liste?.[0];
  return sak?.sak_henvisning?.trim() || sak?.sak_korttittel?.trim() || null;
}

export function getHoringInnspillDeadline(hearing: StortingetHoring): Date | null {
  return parseStortingetDate(hearing.innspillsfrist) ?? parseStortingetDate(hearing.anmodningsfrist_dato_tid);
}

/** @deprecated Use getHoringInnspillDeadline */
export function getHoringDeadline(hearing: StortingetHoring): Date | null {
  return getHoringInnspillDeadline(hearing);
}

export function getHoringApplicationDeadline(hearing: StortingetHoring): Date | null {
  return parseStortingetDate(hearing.soknadfrist_dato);
}

export function getHoringStartDate(hearing: StortingetHoring): Date | null {
  const sessionDates = (hearing.horingstidspunkt_liste ?? [])
    .map((tp) => parseStortingetDate(tp.tidspunkt))
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (sessionDates.length > 0) return sessionDates[0];
  return parseStortingetDate(hearing.start_dato);
}

export function getHoringStatusKind(hearing: StortingetHoring): HoringStatusKind {
  if (hearing.horing_status === 'Avlyst') return 'cancelled';
  if (hearing.horing_status === 'Avholdt') return 'held';
  if (hearing.horing_status === 'Planlagt') return 'planned';
  if (hearing.horing_status === 'Aktiv') {
    const deadline = getHoringInnspillDeadline(hearing);
    if (!deadline) return 'open';
    return deadline > new Date() ? 'open' : 'held';
  }

  const deadline = getHoringInnspillDeadline(hearing);
  if (deadline && deadline <= new Date()) return 'held';
  if (deadline && deadline > new Date()) return 'open';
  return 'held';
}

export function isHoringOpen(hearing: StortingetHoring): boolean {
  return getHoringStatusKind(hearing) === 'open';
}

export function getHoringStatusLabel(hearing: StortingetHoring): string {
  const kind = getHoringStatusKind(hearing);
  switch (kind) {
    case 'open':
      return 'Åpen for innspill';
    case 'planned':
      return 'Planlagt';
    case 'cancelled':
      return 'Avlyst';
    case 'held':
      return hearing.horing_status === 'Avholdt' ? 'Avholdt' : 'Frist utløpt';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function getHoringStatusBadgeClass(kind: HoringStatusKind): string {
  switch (kind) {
    case 'open':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'planned':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200';
    case 'cancelled':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    case 'held':
      return 'bg-muted text-muted-foreground';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function getDaysUntilHoringDeadline(hearing: StortingetHoring): number | null {
  const deadline = getHoringInnspillDeadline(hearing);
  if (!deadline) return null;
  const diffMs = deadline.getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

export function formatHoringDeadlineSummary(hearing: StortingetHoring): string {
  const deadline = getHoringInnspillDeadline(hearing);
  if (deadline) {
    const days = getDaysUntilHoringDeadline(hearing);
    const dateLabel = formatDateNb(deadline);
    if (days != null && days > 0 && isHoringOpen(hearing)) {
      return days === 1 ? `Frist i morgen (${dateLabel})` : `${days} dager til frist (${dateLabel})`;
    }
    if (days === 0 && isHoringOpen(hearing)) {
      return `Frist i dag (${dateLabel})`;
    }
    return `Frist ${dateLabel}`;
  }

  const start = getHoringStartDate(hearing);
  if (hearing.horing_status === 'Planlagt' && start) {
    return `Planlagt ${formatDateNb(start)} — frist ikke publisert`;
  }
  if (start && hearing.horing_status !== 'Avholdt') {
    return `Høring ${formatDateNb(start)}`;
  }
  if (hearing.horing_status === 'Planlagt') {
    return 'Frist ikke publisert ennå';
  }
  return 'Ingen frist oppgitt';
}

export function normalizeStortingetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith('//') ? `https:${url}` : url;
}

export function sortHoringer(hearings: StortingetHoring[]): StortingetHoring[] {
  return [...hearings].sort((a, b) => {
    const kindOrder: Record<HoringStatusKind, number> = {
      open: 0,
      planned: 1,
      held: 2,
      cancelled: 3,
    };
    const aKind = getHoringStatusKind(a);
    const bKind = getHoringStatusKind(b);
    if (kindOrder[aKind] !== kindOrder[bKind]) {
      return kindOrder[aKind] - kindOrder[bKind];
    }

    const aDeadline = getHoringInnspillDeadline(a)?.getTime() ?? getHoringStartDate(a)?.getTime() ?? 0;
    const bDeadline = getHoringInnspillDeadline(b)?.getTime() ?? getHoringStartDate(b)?.getTime() ?? 0;
    return bDeadline - aDeadline;
  });
}

export function summarizeHoringer(hearings: StortingetHoring[]) {
  let open = 0;
  let planned = 0;
  let held = 0;
  for (const hearing of hearings) {
    const kind = getHoringStatusKind(hearing);
    if (kind === 'open') open += 1;
    else if (kind === 'planned') planned += 1;
    else held += 1;
  }
  return { open, planned, held, total: hearings.length };
}
