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

export function parseStortingetDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (raw.includes('Date')) {
    const ms = parseInt(raw.match(/\d+/)?.[0] ?? '', 10);
    if (!Number.isNaN(ms)) {
      const date = new Date(ms);
      if (date.getFullYear() < 1970) return null;
      return date;
    }
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) || d.getFullYear() < 1970 ? null : d;
}

export function formatStortingetDate(raw: string | undefined): string | null {
  const date = parseStortingetDate(raw);
  if (!date) return null;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
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
  return hearing.horing_sak_info_liste?.[0]?.sak_tittel || 'Høring uten tittel';
}

export function getHoringDeadline(hearing: StortingetHoring): Date | null {
  return parseStortingetDate(hearing.innspillsfrist || hearing.anmodningsfrist_dato_tid);
}

export function isHoringOpen(hearing: StortingetHoring): boolean {
  if (hearing.horing_status === 'Avholdt') return false;
  const deadline = getHoringDeadline(hearing);
  if (!deadline) return true;
  return deadline > new Date();
}

export function normalizeStortingetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith('//') ? `https:${url}` : url;
}

export function sortHoringer(hearings: StortingetHoring[]): StortingetHoring[] {
  return [...hearings].sort((a, b) => {
    const aOpen = isHoringOpen(a);
    const bOpen = isHoringOpen(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    const aDeadline = getHoringDeadline(a)?.getTime() ?? 0;
    const bDeadline = getHoringDeadline(b)?.getTime() ?? 0;
    return bDeadline - aDeadline;
  });
}
