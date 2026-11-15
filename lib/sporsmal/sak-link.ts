const HENVISNING_PATTERN =
  /\b(?:Prop\.|Innst\.|Meld\.\s*St\.|Representantforslag)\s+\d+(?:\s+[A-ZÆØÅ])?(?:\s+\(\d{4}-\d{4}\))?/gi;

export type SakHenvisningRow = {
  id: string;
  henvisning: string | null;
};

function normalizeHenvisning(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .trim();
}

/** Extract Stortinget document references from question text. */
export function extractHenvisninger(text: string): string[] {
  const matches = text.match(HENVISNING_PATTERN) ?? [];
  const unique = new Set<string>();
  for (const raw of matches) {
    const normalized = normalizeHenvisning(raw);
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

/**
 * Map normalized henvisning fragment → sak id. Longest keys are matched first so
 * `Prop. 1 L (2025-2026)` wins over `Prop. 1 L`.
 */
export function buildHenvisningToSakIdIndex(rows: SakHenvisningRow[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const henvisning = row.henvisning?.trim();
    if (!henvisning) continue;
    const normalized = normalizeHenvisning(henvisning);
    if (!index.has(normalized)) {
      index.set(normalized, row.id);
    }
    const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (!index.has(part)) index.set(part, row.id);
    }
  }
  return index;
}

function pickBestSakMatch(fragments: string[], index: Map<string, string>): string | null {
  const candidates: Array<{ id: string; length: number }> = [];
  for (const fragment of fragments) {
    const direct = index.get(fragment);
    if (direct) {
      candidates.push({ id: direct, length: fragment.length });
      continue;
    }
    for (const [key, sakId] of index) {
      if (fragment.includes(key) || key.includes(fragment)) {
        candidates.push({ id: sakId, length: Math.max(fragment.length, key.length) });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0]?.id ?? null;
}

export function resolveSporsmalSakId(questionText: string, index: Map<string, string>): string | null {
  const fragments = extractHenvisninger(questionText);
  if (fragments.length === 0) return null;
  return pickBestSakMatch(fragments, index);
}