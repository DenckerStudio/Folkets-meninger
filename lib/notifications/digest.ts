import type { DigestFrequency } from '@/lib/notifications/channels';

export const DIGEST_DEFAULT_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export type DigestItem = {
  title: string;
  url?: string | null;
  createdAt: string;
};

export function resolveDigestSinceIso(
  lastSentIso: string | undefined,
  nowMs = Date.now(),
): string {
  if (lastSentIso) {
    const parsed = new Date(lastSentIso);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date(nowMs - DIGEST_DEFAULT_LOOKBACK_MS).toISOString();
}

export function toAbsoluteNotificationUrl(
  url: string | null | undefined,
  origin: string,
): string | null | undefined {
  if (!url) return url;
  return url.startsWith('/') ? `${origin}${url}` : url;
}

export function shouldSendDigestEmail(items: DigestItem[]): boolean {
  return items.length > 0;
}

export function buildDigestCursorUpdate(
  previous: Record<string, string> | null | undefined,
  channels: string[],
  sentAtIso: string,
): Record<string, string> {
  const next = { ...(previous || {}) };
  for (const channel of channels) {
    next[channel] = sentAtIso;
  }
  return next;
}

export function digestEmailSubject(frequency: DigestFrequency): string {
  return frequency === 'daily'
    ? 'Dine varsler (daglig oppsummering)'
    : 'Dine varsler (ukentlig oppsummering)';
}
