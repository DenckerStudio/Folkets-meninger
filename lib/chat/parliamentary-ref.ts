/**
 * Parse Stortinget sak / hearing identifiers from free-text queries.
 * Used by chat sak search and mirrored in SQL (search_issues_fts).
 */

export type ParliamentaryRefKind = 'issue_id' | 'hearing_id' | 'prop' | 'innst' | 'dokument';

export type ParliamentaryRef = {
  kind: ParliamentaryRefKind;
  /** Normalized token for henvisning / title matching */
  needle: string;
  issueId?: string;
  hearingId?: string;
};

const PROP_RE = /\bprop\.?\s*(\d+)\s*([A-Za-z])?/iu;
const INNST_RE = /\binnst\.?\s*(\d+)\s*([A-Za-z])?/iu;
const DOK_RE = /\bdok(?:ument)?\.?\s*(\d+)\s*:\s*(\d+)\s*([A-Za-z])?/iu;

export function looksLikeHearingId(query: string): boolean {
  const t = (query ?? '').trim();
  return /^\d{7,12}$/.test(t);
}

export function parseParliamentaryRefs(query: string): ParliamentaryRef[] {
  const raw = (query ?? '').trim();
  if (!raw) return [];

  const out: ParliamentaryRef[] = [];

  if (/^\d{4,10}$/.test(raw)) {
    out.push({ kind: 'issue_id', needle: raw, issueId: raw });
    return out;
  }

  if (looksLikeHearingId(raw)) {
    out.push({ kind: 'hearing_id', needle: raw, hearingId: raw });
    return out;
  }

  const prop = PROP_RE.exec(raw);
  if (prop) {
    const letter = (prop[2] ?? 'L').toUpperCase();
    out.push({
      kind: 'prop',
      needle: `Prop. ${prop[1]} ${letter}`,
    });
  }

  const innst = INNST_RE.exec(raw);
  if (innst) {
    const letter = (innst[2] ?? 'L').toUpperCase();
    out.push({
      kind: 'innst',
      needle: `Innst. ${innst[1]} ${letter}`,
    });
  }

  const dok = DOK_RE.exec(raw);
  if (dok) {
    const letter = (dok[3] ?? 'S').toUpperCase();
    out.push({
      kind: 'dokument',
      needle: `Dokument ${dok[1]}:${dok[2]} ${letter}`,
    });
  }

  return out;
}

/** Two-letter Norwegian place names etc. — exact title match, not prefix FTS. */
export function isShortExactPlaceToken(term: string): boolean {
  const t = term.trim();
  return t.length === 2 && /^\p{L}{2}$/u.test(t);
}
