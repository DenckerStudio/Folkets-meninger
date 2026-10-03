export type ChatGateReason = 'login' | 'free' | 'no-key' | 'ready';

export type ChatIssueContext = {
  issueId: string;
  issueTitle?: string | null;
};

export function resolveChatGate(input: {
  authenticated: boolean;
  hasStemmePlus: boolean;
  hasByok: boolean;
}): ChatGateReason {
  if (!input.authenticated) return 'login';
  if (!input.hasStemmePlus) return 'free';
  if (!input.hasByok) return 'no-key';
  return 'ready';
}

/** Overlay actions need login + Stemme+. Sak context, SearXNG, and instruction-only rettskriving work without BYOK; LLM correction uses the user's key when present. */
export function canUseOverlayActions(gate: ChatGateReason): boolean {
  switch (gate) {
    case 'ready':
    case 'no-key':
      return true;
    case 'login':
    case 'free':
      return false;
    default: {
      const _never: never = gate;
      return _never;
    }
  }
}

export function shouldOpenChatFromSearchParams(params: {
  get: (name: string) => string | null;
}): boolean {
  const chat = params.get('chat');
  return chat === '1' || chat === 'open';
}

export function chatDeepLinkQuery(issueId?: string | null): string {
  const params = new URLSearchParams({ chat: '1' });
  const sak = issueId?.trim();
  if (sak) params.set('sak', sak);
  return params.toString();
}

/** Sak id from `/dashboard/sak/[id]` so the orb can default context without `?sak=`. */
export function issueIdFromPathname(pathname: string | null | undefined): string | null {
  const pathOnly = (pathname ?? '').trim().split('?')[0] ?? '';
  const match = /^\/dashboard\/sak\/([^/]+)$/.exec(pathOnly);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

/** Post-login return path that reopens the orb panel (and optional sak). */
export function buildChatLoginNextPath(
  pathname: string | null | undefined,
  issueId?: string | null,
  fallbackPath = '/dashboard/utforsk',
): string {
  const raw = (pathname ?? '').trim() || fallbackPath;
  const pathOnly = raw.split('?')[0] || fallbackPath;
  return `${pathOnly}?${chatDeepLinkQuery(issueId)}`;
}
