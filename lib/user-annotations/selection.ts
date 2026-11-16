const ANCHOR_LEN = 40;

function textNodesIn(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function offsetOfNode(nodes: Text[], node: Node, nodeOffset: number): number | null {
  let total = 0;
  for (const textNode of nodes) {
    if (textNode === node) {
      return total + nodeOffset;
    }
    total += textNode.data.length;
  }
  return null;
}

export type SelectionCapture = {
  quote: string;
  start_offset: number;
  end_offset: number;
  anchor_prefix: string | null;
  anchor_suffix: string | null;
};

export function captureSelectionInRoot(root: HTMLElement, selection: Selection): SelectionCapture | null {
  if (selection.rangeCount < 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const raw = selection.toString();
  const quote = raw.trim();
  if (quote.length === 0) return null;

  const nodes = textNodesIn(root);
  const fullText = nodes.map((n) => n.data).join('');
  let start = offsetOfNode(nodes, range.startContainer, range.startOffset);
  let end = offsetOfNode(nodes, range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start) return null;

  const leadingPad = raw.length - raw.trimStart().length;
  const trailingPad = raw.length - raw.trimEnd().length;
  start += leadingPad;
  end -= trailingPad;
  if (end <= start) return null;

  const prefixStart = Math.max(0, start - ANCHOR_LEN);
  const suffixEnd = Math.min(fullText.length, end + ANCHOR_LEN);

  return {
    quote,
    start_offset: start,
    end_offset: end,
    anchor_prefix: fullText.slice(prefixStart, start) || null,
    anchor_suffix: fullText.slice(end, suffixEnd) || null,
  };
}

export type HighlightSegment = {
  text: string;
  highlighted: boolean;
  annotationId?: string;
  flagType?: string;
};

export function buildHighlightSegments(
  text: string,
  annotations: Array<{ id: string; start_offset: number; end_offset: number; flag_type?: string }>,
): HighlightSegment[] {
  if (annotations.length === 0) {
    return [{ text, highlighted: false }];
  }

  const sorted = [...annotations].sort((a, b) => a.start_offset - b.start_offset);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const ann of sorted) {
    const start = Math.max(0, Math.min(ann.start_offset, text.length));
    const end = Math.max(start, Math.min(ann.end_offset, text.length));
    if (end <= cursor) continue;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), highlighted: false });
    }
    if (end > start) {
      segments.push({
        text: text.slice(start, end),
        highlighted: true,
        annotationId: ann.id,
        flagType: ann.flag_type,
      });
    }
    cursor = Math.max(cursor, end);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false });
  }

  return segments.length > 0 ? segments : [{ text, highlighted: false }];
}