import type { ForumContextItem, ForumContextKind } from '@/lib/forum/context';
import { routes } from '@/lib/routes';

const CONTEXT_LINE_RE =
  /^(?:📋|📢|👤|📄)\s+(Stortingssak|Høring|Politiker|Dokument):\s*(.+?)\s*—\s*(\S+)\s*$/;

function kindFromLabel(label: string): ForumContextKind {
  switch (label) {
    case 'Stortingssak':
      return 'sak';
    case 'Høring':
      return 'hearing';
    case 'Politiker':
      return 'politician';
    case 'Dokument':
      return 'document';
    default:
      return 'document';
  }
}

function idFromHref(kind: ForumContextKind, href: string, title: string): string {
  if (kind === 'sak') {
    const match = href.match(/\/sak\/([^/?#]+)/);
    return match?.[1] ?? title;
  }
  if (kind === 'hearing') {
    const match = href.match(/\/horinger\/([^/?#]+)/);
    return match?.[1] ?? title;
  }
  if (kind === 'politician') {
    const match = href.match(/repId=(\d+)/);
    return match?.[1] ?? title;
  }
  return title;
}

export function parseContextLine(line: string): ForumContextItem | null {
  const match = line.trim().match(CONTEXT_LINE_RE);
  if (!match) return null;

  const kind = kindFromLabel(match[1]);
  let title = match[2].trim();
  let href = match[3].trim();
  let meta: string | null = null;

  if (kind === 'politician') {
    const mentionMatch = title.match(/^@(.+?)(?:\s+\((.+)\))?$/);
    if (mentionMatch) {
      title = mentionMatch[1];
      meta = mentionMatch[2] ?? null;
    }
  }

  if (href.startsWith('/')) {
    href = href;
  }

  return {
    kind,
    id: idFromHref(kind, href, title),
    title,
    subtitle: meta,
    href: href.startsWith('http') ? href : href.startsWith('/') ? href : routes.dashboard + href,
    meta,
  };
}

export function parseContextItemsFromBody(body: string): {
  items: ForumContextItem[];
  cleanBody: string;
} {
  const lines = body.split('\n');
  const items: ForumContextItem[] = [];
  const kept: string[] = [];

  for (const line of lines) {
    const parsed = parseContextLine(line);
    if (parsed) {
      items.push(parsed);
    } else {
      kept.push(line);
    }
  }

  return {
    items,
    cleanBody: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
  };
}

export function parseContextItemsJson(raw: unknown): ForumContextItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ForumContextItem =>
      item &&
      typeof item === 'object' &&
      typeof item.kind === 'string' &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.href === 'string'
  );
}
