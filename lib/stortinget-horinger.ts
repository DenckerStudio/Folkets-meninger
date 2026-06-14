export type StortingetHoring = {
  id: string;
  horing_status?: string;
  komite?: { navn?: string };
  horing_sak_info_liste?: { sak_tittel?: string }[];
  innspillsfrist?: string;
  anmodningsfrist_dato_tid?: string;
};

export function parseStortingetDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (raw.includes('Date')) {
    const ms = parseInt(raw.match(/\d+/)?.[0] ?? '', 10);
    if (!Number.isNaN(ms)) return new Date(ms);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
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
