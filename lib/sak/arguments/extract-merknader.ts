import { createHash } from 'crypto';
import type { SakArgumentItem, SakArgumentSide } from '@/lib/sak/arguments/types';

export type MerknadChunk = {
  document_id: string | null;
  chunk_index: number | null;
  content: string | null;
  metadata?: { section_title?: string | null; document_title?: string | null } | null;
};

const MERKNAD_SECTION_RE = /merknad/i;
const FOR_LINE_RE = /\b(støtter|tilrår|positiv|enig|for)\b/i;
const MOT_LINE_RE = /\b(uenig\w*|mot|kritisk|avviser|bekymr|negative)\b/i;
const LIST_LINE_RE = /^(?:[-•*]|\d+[.)])\s+(.+)$/;

function stableId(prefix: string, text: string): string {
  return `${prefix}-${createHash('sha256').update(text).digest('hex').slice(0, 10)}`;
}

function classifyMerknadLine(line: string): SakArgumentSide | null {
  const hasFor = FOR_LINE_RE.test(line);
  const hasMot = MOT_LINE_RE.test(line);
  if (hasMot && !hasFor) return 'mot';
  if (hasFor && !hasMot) return 'for';
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
    .filter((line) => line.length >= 32 && line.length <= 420);
}

export function extractMerknadArguments(chunks: readonly MerknadChunk[]): SakArgumentItem[] {
  const items: SakArgumentItem[] = [];

  for (const chunk of chunks) {
    const sectionTitle = chunk.metadata?.section_title?.trim() ?? '';
    const content = chunk.content?.trim() ?? '';
    if (!content) continue;
    const inMerknadSection = MERKNAD_SECTION_RE.test(sectionTitle) || MERKNAD_SECTION_RE.test(content.slice(0, 200));
    if (!inMerknadSection) continue;

    for (const line of extractLines(content)) {
      const side = classifyMerknadLine(line);
      if (!side) continue;
      const docId = chunk.document_id?.trim();
      items.push({
        id: stableId('merknad', `${docId ?? 'doc'}:${line}`),
        side,
        text: line.replace(/\s+/g, ' '),
        source: {
          kind: 'merknad',
          label: sectionTitle || chunk.metadata?.document_title?.trim() || 'Dokumentmerknad',
          anchorId: docId ? `sak-dokument-${docId}` : 'dokumenter',
          documentId: docId ?? null,
        },
      });
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.side}:${item.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}