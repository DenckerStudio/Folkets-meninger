import { getSporsmalListe, type SporsmalType } from '@/lib/stortinget';

export type SporsmalLoadResult = {
  ok: boolean;
  items: Awaited<ReturnType<typeof getSporsmalListe>>;
};

export async function loadSporsmalListe(args: {
  type: SporsmalType;
  sesjonId: string;
  status?: string;
}): Promise<SporsmalLoadResult> {
  const { stortingetUrl } = await import('@/lib/stortinget-utils');
  const { sesjonId, type, status } = args;
  try {
    const url = stortingetUrl(`/eksport/${type}`, {
      sesjonid: sesjonId,
      status,
      format: 'json',
    });
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return { ok: false, items: [] };
    }
    const data = (await res.json()) as { sporsmal_liste?: unknown[] };
    return { ok: true, items: data.sporsmal_liste ?? [] };
  } catch (error) {
    console.error(`Error fetching spørsmål (${type}):`, error);
    return { ok: false, items: [] };
  }
}