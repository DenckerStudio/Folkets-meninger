import { getSakKindLabel, type SakKind } from '@/lib/stortinget-sak-presentation';

/** Fakta vi faktisk har om en sak (stortinget_issues / detail_json); brukes til «hvorfor liknende». */
export type SimilarSakFacets = {
  komite: string | null;
  emner: string[];
  sakKind: SakKind | null;
};

const MAX_SHARED_EMNER = 2;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function sameText(a: string, b: string): boolean {
  return a.localeCompare(b, 'nb', { sensitivity: 'base' }) === 0;
}

export function parseSakKind(value: unknown): SakKind | null {
  return value === 'lovforslag' || value === 'representantforslag' ? value : null;
}

function emnerFromRaw(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const entry of raw) {
    const name = cleanText(typeof entry === 'string' ? entry : (entry as { navn?: unknown } | null)?.navn);
    if (name && !names.some((existing) => sameText(existing, name))) names.push(name);
  }
  return names;
}

export function komiteNameFromDetail(komite: unknown): string | null {
  if (typeof komite === 'string') return cleanText(komite);
  if (komite && typeof komite === 'object') return cleanText((komite as { navn?: unknown }).navn);
  return null;
}

/** Normaliserer feltene fra en `stortinget_issues`-rad (JSON-stier fra detail_json). */
export function parseSimilarSakFacets(row: {
  komite_navn?: unknown;
  komite_raw?: unknown;
  emner?: unknown;
  sak_kind?: unknown;
}): SimilarSakFacets {
  const rawKomite = cleanText(row.komite_raw);
  return {
    komite:
      cleanText(row.komite_navn) ?? (rawKomite && !rawKomite.startsWith('{') ? rawKomite : null),
    emner: emnerFromRaw(row.emner),
    sakKind: parseSakKind(row.sak_kind),
  };
}

/**
 * Grunner til at en sak er liknende, kun fra felles fakta: emne, komité og sakstype.
 * Tom liste når vi ikke har noe felles å vise (ingen oppdiktede grunner).
 */
export function buildSimilarSakReasons(
  current: SimilarSakFacets | null | undefined,
  candidate: SimilarSakFacets | null | undefined,
): string[] {
  if (!current || !candidate) return [];
  const reasons: string[] = [];

  const sharedEmner = candidate.emner.filter((emne) =>
    current.emner.some((currentEmne) => sameText(currentEmne, emne)),
  );
  if (sharedEmner.length > 0) {
    reasons.push(`${sharedEmner.length > 1 ? 'Samme emner' : 'Samme emne'}: ${sharedEmner.slice(0, MAX_SHARED_EMNER).join(', ')}`);
  }

  if (current.komite && candidate.komite && sameText(current.komite, candidate.komite)) {
    reasons.push(`Samme komité: ${candidate.komite}`);
  }

  if (current.sakKind && candidate.sakKind && current.sakKind === candidate.sakKind) {
    reasons.push(`Samme sakstype: ${getSakKindLabel(candidate.sakKind).toLowerCase()}`);
  }

  return reasons;
}
