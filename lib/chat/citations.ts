/**
 * Per-request source numbering for Stemme+-chat (plan P2/P3).
 *
 * Every chat request gets one registry. Tools register the saker, documents,
 * hearings and web pages they return and get back a stable number `n`; the
 * model cites facts as `[n]`, and the client maps `[n]` back to the source.
 * Numbers are unique within one request (one assistant turn) and de-duplicated
 * per source, so several chunks from the same document share one number.
 */

export type ChatSourceKind = 'sak' | 'dokument' | 'høring' | 'politiker' | 'avstemning' | 'nett';

export type ChatSource = {
  n: number;
  kind: ChatSourceKind;
  title: string;
  issueId: string | null;
  documentId: string | null;
  hearingId: string | null;
  /** Stortinget person-id for `politiker` sources. */
  personId: string | null;
  /** App poll id for `avstemning` sources. */
  pollId: string | null;
  /** External URL when the tool already has one (web results, Stortinget pages). */
  url: string | null;
};

export type ChatSourceInput = Omit<
  ChatSource,
  'n' | 'issueId' | 'documentId' | 'hearingId' | 'personId' | 'pollId' | 'url'
> & {
  issueId?: string | null;
  documentId?: string | null;
  hearingId?: string | null;
  personId?: string | null;
  pollId?: string | null;
  url?: string | null;
};

export type CitationRegistry = {
  cite: (input: ChatSourceInput) => ChatSource;
  list: () => ChatSource[];
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function chatSourceKey(source: Omit<ChatSource, 'n'>): string {
  switch (source.kind) {
    case 'sak':
      return `sak:${source.issueId ?? source.title}`;
    case 'dokument':
      return `dokument:${source.issueId ?? ''}:${source.documentId ?? source.title}`;
    case 'høring':
      return `høring:${source.hearingId ?? source.url ?? source.title}`;
    case 'politiker':
      return `politiker:${source.personId ?? source.title}`;
    case 'avstemning':
      return `avstemning:${source.pollId ?? source.title}`;
    case 'nett':
      return `nett:${source.url ?? source.title}`;
  }
}

export function createCitationRegistry(): CitationRegistry {
  const byKey = new Map<string, ChatSource>();

  return {
    cite(input) {
      const normalized: Omit<ChatSource, 'n'> = {
        kind: input.kind,
        title: clean(input.title) ?? 'Uten tittel',
        issueId: clean(input.issueId),
        documentId: clean(input.documentId),
        hearingId: clean(input.hearingId),
        personId: clean(input.personId),
        pollId: clean(input.pollId),
        url: clean(input.url),
      };
      const key = chatSourceKey(normalized);
      const existing = byKey.get(key);
      if (existing) return existing;
      const source: ChatSource = { n: byKey.size + 1, ...normalized };
      byKey.set(key, source);
      return source;
    },
    list() {
      return [...byKey.values()];
    },
  };
}

/** Unique sources by number, in citation order — for a tool's `kilder` field. */
export function uniqueSources(sources: readonly ChatSource[]): ChatSource[] {
  const seen = new Map<number, ChatSource>();
  for (const source of sources) {
    if (!seen.has(source.n)) seen.set(source.n, source);
  }
  return [...seen.values()].sort((a, b) => a.n - b.n);
}
