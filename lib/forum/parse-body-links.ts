import type { ForumContextItem } from '@/lib/forum/context';
import { routes } from '@/lib/routes';

export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string }
  | { type: 'internal-link'; href: string; label: string; meta?: ForumContextItem };

const CONTEXT_PREFIXES = [
  { prefix: '📋 Stortingssak: ', kind: 'sak' as const },
  { prefix: '📢 Høring: ', kind: 'hearing' as const },
  { prefix: '👤 Politiker: ', kind: 'politician' as const },
  { prefix: '📄 Dokument: ', kind: 'document' as const },
  { prefix: '🔗 Kilde: ', kind: 'document' as const },
];

const DASHBOARD_PATH_RE = /(\/dashboard\/[^\s<>"')\]]+)/g;

export function parseInternalDashboardPath(path: string): {
  kind: ForumContextItem['kind'] | 'forum';
  id: string;
} | null {
  const sak = path.match(/^\/dashboard\/sak\/([^/?#]+)/);
  if (sak) return { kind: 'sak', id: sak[1] };

  const hearing = path.match(/^\/dashboard\/horinger\/([^/?#]+)/);
  if (hearing) return { kind: 'hearing', id: hearing[1] };

  const forum = path.match(/^\/dashboard\/forum\/([^/?#]+)/);
  if (forum && forum[1] !== 'ny' && forum[1] !== 'mine-innlegg') {
    return { kind: 'forum', id: forum[1] };
  }

  const politician = path.match(/^\/dashboard\/politikere\/([^/?#]+)/);
  if (politician) return { kind: 'politician', id: politician[1] };

  return null;
}

function metaForHref(href: string, linkedItems: ForumContextItem[]): ForumContextItem | undefined {
  return linkedItems.find((item) => item.href === href);
}

function labelForPath(path: string, linkedItems: ForumContextItem[]): string {
  const meta = metaForHref(path, linkedItems);
  if (meta) return meta.title;

  const parsed = parseInternalDashboardPath(path);
  if (parsed?.kind === 'sak') return 'Stortingssak';
  if (parsed?.kind === 'hearing') return 'Høring';
  if (parsed?.kind === 'forum') return 'Forumtråd';
  if (parsed?.kind === 'politician') return 'Politiker';
  return 'Intern lenke';
}

function parseContextLine(
  line: string,
  linkedItems: ForumContextItem[]
): BodySegment[] | null {
  for (const { prefix } of CONTEXT_PREFIXES) {
    if (!line.startsWith(prefix)) continue;

    const rest = line.slice(prefix.length);
    const legacySplit = rest.split(/\s*—\s*(\/dashboard\/[^\s]+)/);
    const title = legacySplit[0]?.trim() ?? rest.trim();
    const href = legacySplit[1]?.trim();

    if (href) {
      return [
        { type: 'text', text: prefix },
        {
          type: 'internal-link',
          href,
          label: title,
          meta: metaForHref(href, linkedItems),
        },
      ];
    }

    const matched = linkedItems.find((item) => item.title === title);
    if (matched?.href.startsWith('/dashboard')) {
      return [
        { type: 'text', text: prefix },
        {
          type: 'internal-link',
          href: matched.href,
          label: title,
          meta: matched,
        },
      ];
    }

    return [{ type: 'text', text: line }];
  }

  return null;
}

function parseInlineParts(line: string, linkedItems: ForumContextItem[]): BodySegment[] {
  const parts = line.split(DASHBOARD_PATH_RE);
  const segments: BodySegment[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith('/dashboard/')) {
      segments.push({
        type: 'internal-link',
        href: part,
        label: labelForPath(part, linkedItems),
        meta: metaForHref(part, linkedItems),
      });
      continue;
    }

    const mentionParts = part.split(/(@[\p{L}0-9_.-]{2,32})/giu);
    for (const segment of mentionParts) {
      if (!segment) continue;
      if (segment.startsWith('@')) {
        segments.push({ type: 'mention', text: segment });
      } else {
        segments.push({ type: 'text', text: segment });
      }
    }
  }

  return segments;
}

export function parseBodySegments(body: string, linkedItems: ForumContextItem[] = []): BodySegment[] {
  if (!body) return [{ type: 'text', text: '' }];

  const lines = body.split('\n');
  const segments: BodySegment[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) segments.push({ type: 'text', text: '\n' });

    const contextSegments = parseContextLine(line, linkedItems);
    if (contextSegments) {
      segments.push(...contextSegments);
      return;
    }

    segments.push(...parseInlineParts(line, linkedItems));
  });

  return segments.length > 0 ? segments : [{ type: 'text', text: body }];
}

export function fallbackMetaFromPath(href: string): ForumContextItem | null {
  const parsed = parseInternalDashboardPath(href);
  if (!parsed || parsed.kind === 'forum') return null;

  if (parsed.kind === 'sak') {
    return {
      kind: 'sak',
      id: parsed.id,
      title: 'Stortingssak',
      href: routes.sak(parsed.id),
    };
  }

  if (parsed.kind === 'hearing') {
    return {
      kind: 'hearing',
      id: parsed.id,
      title: 'Høring',
      href: routes.horing(parsed.id),
    };
  }

  return {
    kind: 'politician',
    id: parsed.id,
    title: 'Politiker',
    href: routes.politiker(parsed.id),
  };
}
