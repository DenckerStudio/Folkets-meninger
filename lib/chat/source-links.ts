/**
 * Map numbered chat sources (`[n]`, see `lib/chat/citations.ts`) to links in
 * the app (plan P3). Saker go to the sak page, documents open the document
 * viewer on the sak page (`?dokument=` deep link), hearings go to the hearing
 * page, politicians to the politician page and app polls to the poll page.
 * Only web results link out of the app.
 */
import type { ChatSource, ChatSourceKind } from '@/lib/chat/citations';
import { routes } from '@/lib/routes';

export type ChatSourceLink = {
  n: number;
  href: string;
  external: boolean;
  title: string;
  kind: ChatSourceKind;
};

const KINDS: readonly ChatSourceKind[] = ['sak', 'dokument', 'høring', 'politiker', 'avstemning', 'nett'];

function safeExternal(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sakPath(issueId: string): string {
  return routes.sak(encodeURIComponent(issueId));
}

export function chatSourceHref(source: ChatSource): { href: string; external: boolean } | null {
  switch (source.kind) {
    case 'sak':
      return source.issueId ? { href: sakPath(source.issueId), external: false } : null;
    case 'dokument':
      if (source.issueId && source.documentId) {
        return {
          href: `${sakPath(source.issueId)}?dokument=${encodeURIComponent(source.documentId)}#dokumenter`,
          external: false,
        };
      }
      if (source.hearingId) {
        return { href: routes.horing(encodeURIComponent(source.hearingId)), external: false };
      }
      const docUrl = safeExternal(source.url);
      if (docUrl) return { href: docUrl, external: true };
      return source.issueId ? { href: `${sakPath(source.issueId)}#dokumenter`, external: false } : null;
    case 'høring': {
      if (source.hearingId) {
        return { href: routes.horing(encodeURIComponent(source.hearingId)), external: false };
      }
      if (source.issueId) return { href: sakPath(source.issueId), external: false };
      const url = safeExternal(source.url);
      return url ? { href: url, external: true } : null;
    }
    case 'politiker':
      return source.personId
        ? { href: routes.politiker(encodeURIComponent(source.personId)), external: false }
        : null;
    case 'avstemning':
      if (source.pollId) return { href: routes.poll(encodeURIComponent(source.pollId)), external: false };
      return source.issueId ? { href: sakPath(source.issueId), external: false } : null;
    case 'nett': {
      const url = safeExternal(source.url);
      return url ? { href: url, external: true } : null;
    }
  }
}

function asSource(value: unknown): ChatSource | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const n = row.n;
  const kind = row.kind;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) return null;
  if (typeof kind !== 'string' || !KINDS.includes(kind as ChatSourceKind)) return null;
  const str = (key: string) => (typeof row[key] === 'string' && (row[key] as string).trim() ? (row[key] as string).trim() : null);
  return {
    n,
    kind: kind as ChatSourceKind,
    title: str('title') ?? 'Kilde',
    issueId: str('issueId'),
    documentId: str('documentId'),
    hearingId: str('hearingId'),
    personId: str('personId'),
    pollId: str('pollId'),
    url: str('url'),
  };
}

/**
 * Collect `[n]` → link for one assistant message from the `kilder` lists in
 * its finished tool parts. Numbers are per assistant turn, so each message is
 * resolved on its own; an `[n]` with no matching source stays plain text.
 */
export function collectChatSourceLinks(parts: readonly unknown[]): Map<number, ChatSourceLink> {
  const links = new Map<number, ChatSourceLink>();
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const record = part as { type?: unknown; state?: unknown; output?: unknown };
    if (typeof record.type !== 'string' || !record.type.startsWith('tool-')) continue;
    if (record.state !== 'output-available') continue;
    const output = record.output as { kilder?: unknown } | null | undefined;
    if (!output || !Array.isArray(output.kilder)) continue;
    for (const raw of output.kilder) {
      const source = asSource(raw);
      if (!source || links.has(source.n)) continue;
      const target = chatSourceHref(source);
      if (!target) continue;
      links.set(source.n, { n: source.n, ...target, title: source.title, kind: source.kind });
    }
  }
  return links;
}

export type ChatLinkClick = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type ChatLinkAnchor = {
  href: string | null;
  target: string | null;
  download: boolean;
};

/**
 * True when a click on a link inside the chat navigates the app in this tab
 * (a [n] source or a tool card link). The chat panel is a modal over the page,
 * so the caller closes it; otherwise the page changes behind the panel and the
 * tap looks dead on mobile. New-tab clicks and external links leave it open.
 */
export function isInAppNavigationClick(click: ChatLinkClick, anchor: ChatLinkAnchor, origin: string): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.download) return false;
  const target = anchor.target?.trim().toLowerCase();
  if (target && target !== '_self') return false;
  const href = anchor.href?.trim();
  if (!href || href.startsWith('#')) return false;
  try {
    const url = new URL(href, origin);
    return url.origin === origin && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}
