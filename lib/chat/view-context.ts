/**
 * What the user is looking at when the Stemme+ chat opens. Resolved from the
 * pathname so the suggestion engine can tailor prompts to the current page.
 */

export type ChatViewKind =
  | 'sak'
  | 'mening'
  | 'politiker'
  | 'reel'
  | 'horing'
  | 'utforsk'
  | 'folkets-meninger'
  | 'horinger'
  | 'general';

export type ChatViewRef = {
  kind: ChatViewKind;
  id: string | null;
};

const VIEW_PATTERNS: Array<{ kind: ChatViewKind; pattern: RegExp }> = [
  { kind: 'sak', pattern: /^\/dashboard\/sak\/([^/]+)$/ },
  { kind: 'mening', pattern: /^\/dashboard\/folkets-meninger\/([^/]+)$/ },
  { kind: 'politiker', pattern: /^\/dashboard\/politikere\/([^/]+)$/ },
  { kind: 'reel', pattern: /^\/dashboard\/avstemninger\/([^/]+)$/ },
  { kind: 'horing', pattern: /^\/dashboard\/horinger\/([^/]+)$/ },
];

const STATIC_VIEWS: Array<{ kind: ChatViewKind; path: string }> = [
  { kind: 'utforsk', path: '/dashboard/utforsk' },
  { kind: 'folkets-meninger', path: '/dashboard/folkets-meninger' },
  { kind: 'horinger', path: '/dashboard/horinger' },
];

function decodeId(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** Parse a pathname into a coarse view kind plus the entity id when present. */
export function resolveChatView(pathname: string | null | undefined): ChatViewRef {
  const pathOnly = (pathname ?? '').trim().split('?')[0]?.split('#')[0] ?? '';
  if (!pathOnly) return { kind: 'general', id: null };

  for (const { kind, pattern } of VIEW_PATTERNS) {
    const match = pattern.exec(pathOnly);
    if (match?.[1]) {
      return { kind, id: decodeId(match[1]) };
    }
  }

  for (const { kind, path } of STATIC_VIEWS) {
    if (pathOnly === path) return { kind, id: null };
  }

  return { kind: 'general', id: null };
}

/** Stable key for a view, used for caching and effect dependencies. */
export function chatViewKey(view: ChatViewRef | null | undefined): string {
  if (!view) return 'general';
  return view.id ? `${view.kind}:${view.id}` : view.kind;
}
