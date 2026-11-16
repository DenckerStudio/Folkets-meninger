import { createHash } from 'crypto';
import { sakDocumentListAnchorId, sakDocumentTabHref } from '@/lib/sak/anchors';
import type { SakArgumentItem, SakArgumentSide } from '@/lib/sak/arguments/types';

export type MerknadChunk = {
  document_id: string | null;
  chunk_index: number | null;
  content: string | null;
  metadata?: { section_title?: string | null; document_title?: string | null } | null;
};

const MERKNAD_SECTION_RE = /merknad/i;
const LIST_LINE_RE = /^(?:[-•*]|\d+[.)])\s+(.+)$/;

const EXPLICIT_FOR_RE =
  /\b(går inn for|står bak|støtter forslaget|er enig i|vi er enige i|tilrår at|innstiller på at)\b/i;
const EXPLICIT_MOT_RE =
  /\b(står imot|går imot|er uenig i|vi er uenige i|avsier forslaget|fraråder|motsetter seg forslaget)\b/i;

/** Named party or group before the argument (e.g. "Ap:", "FrP –", "Sosialistisk Venstreparti (SV)"). */
const NAMED_SENDER_RE =
  /^(?:[A-ZÆØÅ][\p{L}\d\s\-–]+?(?:\s*\([^)]+\))?\s*[:–-]\s*|(?:Ap|H|FrP|SV|V|MDG|R|Sp)\s)/u;

function stableId(prefix: string, text: string): string {
  return `${prefix}-${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

export function classifyExplicitMerknadStance(line: string): SakArgumentSide | null {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (!NAMED_SENDER_RE.test(normalized)) return null;

  const hasFor = EXPLICIT_FOR_RE.test(normalized);
  const hasMot = EXPLICIT_MOT_RE.test(normalized);
  if (hasFor && !hasMot) return 'for';
  if (hasMot && !hasFor) return 'mot';
  return null;
}

function extractLines(content: string): string[] {
  return content
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      const listMatch = trimmed.match(LIST_LINE_RE);
      return (listMatch?.[1] ?? trimmed).trim();
    })
    .filter((line) => line.length >= 24 && line.length <= 420);
}

export function extractMerknadArguments(
  sakId: string,
  chunks: readonly MerknadChunk[],
): SakArgumentItem[] {
  const items: SakArgumentItem[] = [];

  for (const chunk of chunks) {
    const sectionTitle = chunk.metadata?.section_title?.trim() ?? '';
    const content = chunk.content?.trim() ?? '';
    if (!content) continue;
    const inMerknadSection = MERKNAD_SECTION_RE.test(sectionTitle) || MERKNAD_SECTION_RE.test(content.slice(0, 200));
    if (!inMerknadSection) continue;

    for (const line of extractLines(content)) {
      const side = classifyExplicitMerknadStance(line);
      if (!side) continue;
      const docId = chunk.document_id?.trim();
      items.push({
        id: stableId('merknad', `${docId ?? 'doc'}:${line}`),
        side,
        text: line.replace(/\s+/g, ' '),
        source: {
          kind: 'merknad',
          label: sectionTitle || chunk.metadata?.document_title?.trim() || 'Dokumentmerknad',
          href: docId ? sakDocumentTabHref(sakId, docId) : null,
          anchorId: docId ? sakDocumentListAnchorId(docId) : 'dokumenter',
          documentId: docId ?? null,
        },
      });
    }
  }

  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = `${item.side}:${item.text.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}