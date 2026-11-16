import type { OpinionListItem } from '@/lib/opinions/types';
import type { SakDocumentRef } from '@/lib/stortinget-documents';
import type { SakPageTabId } from '@/lib/sak/sak-page-tabs';
import { sakDocumentListAnchorId, sakOpinionAnchorId } from '@/lib/sak/anchors';

export type SakSearchTargetKind = 'tittel' | 'sammendrag' | 'dokument' | 'mening' | 'innstilling' | 'argument';

export type SakSearchHit = {
  id: string;
  label: string;
  snippet: string;
  kind: SakSearchTargetKind;
  tab: SakPageTabId;
  anchorId: string;
  score: number;
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreMatch(haystack: string, query: string): number {
  const h = normalize(haystack);
  const q = normalize(query);
  if (!q || !h) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  if (h.includes(q)) return 50;
  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => h.includes(token))) return 40;
  return 0;
}

function pushHit(
  hits: SakSearchHit[],
  hit: Omit<SakSearchHit, 'score'> & { text: string },
  query: string,
) {
  const score = scoreMatch(hit.text, query);
  if (score <= 0) return;
  hits.push({
    id: hit.id,
    label: hit.label,
    snippet: hit.snippet,
    kind: hit.kind,
    tab: hit.tab,
    anchorId: hit.anchorId,
    score,
  });
}

export function searchSakPage(args: {
  query: string;
  title: string;
  summary: string | null;
  documents: readonly Pick<SakDocumentRef, 'id' | 'title'>[];
  opinions: readonly Pick<OpinionListItem, 'id' | 'title' | 'body'>[];
  innstillingSnippet: string | null;
  argumentSnippets: readonly { id: string; text: string; side: 'for' | 'mot' }[];
}): SakSearchHit[] {
  const query = args.query.trim();
  if (query.length < 2) return [];

  const hits: SakSearchHit[] = [];

  pushHit(
    hits,
    {
      id: 'search-title',
      label: 'Sakstittel',
      snippet: args.title,
      kind: 'tittel',
      tab: 'oversikt',
      anchorId: 'sak-tittel',
      text: args.title,
    },
    query,
  );

  if (args.summary) {
    pushHit(
      hits,
      {
        id: 'search-summary',
        label: 'Offisiell beskrivelse',
        snippet: args.summary.slice(0, 160),
        kind: 'sammendrag',
        tab: 'oversikt',
        anchorId: 'sak-offisiell-beskrivelse',
        text: args.summary,
      },
      query,
    );
  }

  if (args.innstillingSnippet) {
    pushHit(
      hits,
      {
        id: 'search-innstilling',
        label: 'Komiteens innstilling',
        snippet: args.innstillingSnippet.slice(0, 160),
        kind: 'innstilling',
        tab: 'oversikt',
        anchorId: 'sak-innstilling',
        text: args.innstillingSnippet,
      },
      query,
    );
  }

  for (const doc of args.documents) {
    pushHit(
      hits,
      {
        id: `search-doc-${doc.id}`,
        label: doc.title,
        snippet: doc.title,
        kind: 'dokument',
        tab: 'dokumenter',
        anchorId: sakDocumentListAnchorId(doc.id),
        text: doc.title,
      },
      query,
    );
  }

  for (const opinion of args.opinions) {
    const text = `${opinion.title}\n${opinion.body}`;
    pushHit(
      hits,
      {
        id: `search-mening-${opinion.id}`,
        label: opinion.title,
        snippet: opinion.body.slice(0, 160),
        kind: 'mening',
        tab: 'oversikt',
        anchorId: sakOpinionAnchorId(opinion.id),
        text,
      },
      query,
    );
  }

  for (const argument of args.argumentSnippets) {
    pushHit(
      hits,
      {
        id: `search-arg-${argument.id}`,
        label: argument.side === 'for' ? 'Argument for' : 'Argument mot',
        snippet: argument.text.slice(0, 160),
        kind: 'argument',
        tab: 'oversikt',
        anchorId: 'sak-argumenter',
        text: argument.text,
      },
      query,
    );
  }

  return hits
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'nb'))
    .slice(0, 12);
}