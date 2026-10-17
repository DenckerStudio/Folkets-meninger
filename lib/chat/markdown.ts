/**
 * Minimal, dependency-free Markdown parser for assistant replies. Handles the
 * subset the chat actually emits: bold, italics, inline code, links, headings,
 * fenced code blocks, and ordered/unordered lists. Returns a structured tree so
 * the renderer never needs `dangerouslySetInnerHTML`.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; value: string }
  /** Source marker `[n]` from prompt v2; resolved to a link by the renderer. */
  | { type: 'citation'; n: number };

export type MarkdownBlock =
  | { type: 'paragraph'; nodes: InlineNode[] }
  | { type: 'heading'; level: number; nodes: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'code'; value: string };

const INLINE_PATTERN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(\[\d{1,3}\](?!\())/;

function parseInline(value: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = value;

  while (rest.length > 0) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match || match.index === undefined) {
      nodes.push({ type: 'text', value: rest });
      break;
    }

    if (match.index > 0) {
      nodes.push({ type: 'text', value: rest.slice(0, match.index) });
    }

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push({ type: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      nodes.push({ type: 'strong', value: token.slice(2, -2) });
    } else if (token.startsWith('__')) {
      nodes.push({ type: 'strong', value: token.slice(2, -2) });
    } else if (/^\[\d{1,3}\]$/.test(token)) {
      nodes.push({ type: 'citation', n: Number(token.slice(1, -1)) });
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push({ type: 'link', value: linkMatch[1], href: linkMatch[2] });
      } else {
        nodes.push({ type: 'text', value: token });
      }
    } else {
      nodes.push({ type: 'em', value: token.slice(1, -1) });
    }

    rest = rest.slice(match.index + token.length);
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', value: '' }];
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const UNORDERED_PATTERN = /^[-*+]\s+(.*)$/;
const ORDERED_PATTERN = /^\d+[.)]\s+(.*)$/;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', nodes: parseInline(text) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: 'list',
      ordered: list.ordered,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      flushList();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', value: codeLines.join('\n') });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING_PATTERN.exec(line.trim());
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        nodes: parseInline(heading[2].trim()),
      });
      continue;
    }

    const unordered = UNORDERED_PATTERN.exec(line.trim());
    const ordered = ORDERED_PATTERN.exec(line.trim());
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((unordered ? unordered[1] : ordered![1]).trim());
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}
