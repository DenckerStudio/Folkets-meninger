import { parseStortingetDate } from '@/lib/stortinget-horinger';
import type { SporsmalType } from '@/lib/stortinget';

export type StortingetSporsmal = {
  id?: string | number;
  tittel?: string;
  sporsmal?: string;
  status?: string | number;
  type?: string;
  sendt_dato?: string;
  datert_dato?: string;
  besvart_dato?: string;
  sporsmal_nummer?: number;
  sesjon_id?: string;
  sporsmal_fra?: {
    fornavn?: string;
    etternavn?: string;
    id?: string;
    parti?: { navn?: string };
    fylke?: { navn?: string };
  };
  sporsmal_til_minister_tittel?: string;
  besvart_av_minister_tittel?: string;
  emne_liste?: Array<{ navn?: string; er_hovedemne?: boolean }>;
};

export function sporsmalTypeLabel(type: SporsmalType): string {
  if (type === 'sporretimesporsmal') return 'Spørretimespørsmål';
  if (type === 'interpellasjoner') return 'Interpellasjoner';
  return 'Skriftlige spørsmål';
}

export function formatSporsmalStatus(status: string | number | undefined): string | null {
  if (status === undefined || status === null || status === '') return null;
  const labels: Record<string, string> = {
    '1': 'Registrert',
    besvart: 'Besvart',
    ubesvart: 'Ubesvart',
    under_behandling: 'Under behandling',
    avsluttet: 'Avsluttet',
  };
  const key = String(status).toLowerCase();
  return labels[key] ?? key.replace(/_/g, ' ');
}

export function formatSporsmalDate(value: unknown): string | null {
  const date = parseStortingetDate(value ? String(value) : undefined);
  if (!date || date.getFullYear() < 1970) return null;
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function getSporsmalTitle(item: StortingetSporsmal): string {
  const raw = item.tittel || item.sporsmal;
  if (!raw) return item.id ? `Spørsmål ${item.id}` : 'Spørsmål';
  return raw.length > 200 ? `${raw.slice(0, 200).trim()}…` : raw;
}

export function getSporsmalFraNavn(item: StortingetSporsmal): string | null {
  const fra = item.sporsmal_fra;
  if (!fra?.fornavn && !fra?.etternavn) return null;
  return [fra.fornavn, fra.etternavn].filter(Boolean).join(' ');
}

export function isSporsmalBesvart(item: StortingetSporsmal): boolean {
  return Boolean(item.besvart_dato && formatSporsmalDate(item.besvart_dato));
}

export function getSporsmalEmner(item: StortingetSporsmal): string[] {
  return (item.emne_liste ?? [])
    .map((e) => e.navn)
    .filter((n): n is string => Boolean(n));
}

export async function findSporsmalById(id: string, sesjonId: string): Promise<{ item: StortingetSporsmal; type: SporsmalType } | null> {
  const { getSporsmalListe } = await import('@/lib/stortinget');
  for (const type of ['skriftligesporsmal', 'sporretimesporsmal', 'interpellasjoner'] as const) {
    const list = await getSporsmalListe({ type, sesjonId, nextRevalidateSeconds: 3600 });
    const match = list.find((q) => String(q.id) === String(id));
    if (match) return { item: match as StortingetSporsmal, type };
  }
  return null;
}
