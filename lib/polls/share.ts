import { DEFAULT_SITE_URL } from '@/lib/seo/metadata';
import type { PollChoice, PollRecord } from '@/lib/polls/types';
import type { PollEmbedOptions } from '@/lib/polls/embed';
import { serializePollEmbedOptions } from '@/lib/polls/embed';
import { POLL_BALLOT_CHOICES, POLL_BALLOT_OPTIONS_PHRASE } from '@/lib/polls/labels';

/**
 * Shareable Ja / Nei / Blank poll widget helpers.
 *
 * Polls reuse the existing `polls` / `poll_votes` schema. Only official tracks
 * (`stortinget`, `system`) with an open/closed status may be shared; hidden or
 * legacy `citizen` polls are never exposed by the share pages or OG images.
 * Nothing here touches the database.
 */

export type PollShareTarget = 'reddit' | 'facebook' | 'linkedin' | 'x';
export type PollShareChannel = PollShareTarget | 'native' | 'copy' | 'embed';

export const POLL_SHARE_TARGETS: PollShareTarget[] = ['reddit', 'facebook', 'linkedin', 'x'];

export const POLL_SHARE_TARGET_LABELS: Record<PollShareTarget, string> = {
  reddit: 'Reddit',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
};

/** Canonical production origin, shared with the SEO metadata helpers. */
export const DEFAULT_SITE_ORIGIN = DEFAULT_SITE_URL;

/** Same ballot order and values as dashboard polls (`POLL_BALLOT_CHOICES`). */
export { POLL_BALLOT_CHOICES };

export function isPollChoice(value: unknown): value is PollChoice {
  return value === 'ja' || value === 'nei' || value === 'blank';
}

/** Only official, published polls can be shared. Drafts, archived and citizen polls cannot. */
export function isShareablePoll(
  poll: Pick<PollRecord, 'track' | 'status'> | null | undefined,
): boolean {
  if (!poll) return false;
  if (poll.track !== 'stortinget' && poll.track !== 'system') return false;
  return poll.status === 'open' || poll.status === 'closed';
}

export function normalizeOrigin(input?: string | null): string {
  const raw = (input ?? '').trim();
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

function isLocalHost(host: string): boolean {
  return (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  );
}

/**
 * Resolve the canonical site origin for share links, `og:url` and embed snippets.
 *
 * Uses the configured app origin (`NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`)
 * when set so alias or internal hosts never leak into canonical URLs. Without
 * configuration, only local development hosts (`localhost`, loopback) use the
 * request origin; everything else falls back to {@link DEFAULT_SITE_ORIGIN}.
 */
export function resolveShareOrigin(
  input: {
    configured?: string | null;
    forwardedProto?: string | null;
    host?: string | null;
  } = {},
): string {
  const configured = input.configured?.trim();
  if (configured) return normalizeOrigin(configured);

  const host = input.host?.trim();
  if (host && isLocalHost(host)) {
    const proto = input.forwardedProto?.split(',')[0]?.trim() || 'http';
    return normalizeOrigin(`${proto}://${host}`);
  }

  return DEFAULT_SITE_ORIGIN;
}

/** Path of the public share page. */
export function pollSharePath(pollId: string): string {
  return `/del/${encodeURIComponent(pollId)}`;
}

/** Absolute public share URL for a poll. Always parameter-free (canonical / og:url). */
export function buildPollShareUrl(pollId: string, origin?: string | null): string {
  return new URL(pollSharePath(pollId), `${normalizeOrigin(origin)}/`).toString();
}

/** Relative share path with the chosen answer + ref, used for the login round-trip. */
export function buildPollShareRelativePath(
  pollId: string,
  input: { choice?: PollChoice | null; ref?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (input.choice && isPollChoice(input.choice)) params.set('valg', input.choice);
  if (input.ref) params.set('ref', input.ref);
  const query = params.toString();
  return query ? `${pollSharePath(pollId)}?${query}` : pollSharePath(pollId);
}

const CHANNEL_UTM: Record<
  PollShareChannel,
  { source: string; medium: string; ref: string }
> = {
  facebook: { source: 'facebook', medium: 'social', ref: 'fb' },
  linkedin: { source: 'linkedin', medium: 'social', ref: 'li' },
  x: { source: 'x', medium: 'social', ref: 'x' },
  reddit: { source: 'reddit', medium: 'social', ref: 'rd' },
  native: { source: 'native', medium: 'share', ref: 'ns' },
  copy: { source: 'copy', medium: 'share', ref: 'cp' },
  embed: { source: 'embed', medium: 'embed', ref: 'embed' },
};

/**
 * Channel-specific share URL. Social channels carry standard UTM parameters plus
 * a short `ref`; the embed link only carries `ref`.
 */
export function buildPollShareChannelUrl(
  pollId: string,
  origin: string | null | undefined,
  channel: PollShareChannel,
  ref?: string | null,
): string {
  const url = new URL(pollSharePath(pollId), `${normalizeOrigin(origin)}/`);
  const utm = CHANNEL_UTM[channel];
  if (channel !== 'embed') {
    url.searchParams.set('utm_source', utm.source);
    url.searchParams.set('utm_medium', utm.medium);
    url.searchParams.set('utm_campaign', 'poll_share');
  }
  const refValue = ref?.trim() || utm.ref;
  if (refValue) url.searchParams.set('ref', refValue);
  return url.toString();
}

/** Path of the iframe embed route. */
export function pollEmbedPath(pollId: string): string {
  return `/embed/${encodeURIComponent(pollId)}`;
}

/** Absolute embed URL with validated options. */
export function buildPollEmbedUrl(
  pollId: string,
  origin: string | null | undefined,
  options: Partial<PollEmbedOptions> = {},
): string {
  const url = new URL(pollEmbedPath(pollId), `${normalizeOrigin(origin)}/`);
  url.search = serializePollEmbedOptions(options);
  return url.toString();
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type PollEmbedSnippetInput = {
  pollId: string;
  origin?: string | null;
  title?: string;
  options?: Partial<PollEmbedOptions>;
  /** Include `embed.js` for automatic iframe height. */
  autoHeight?: boolean;
};

/** Ready-to-paste iframe snippet for partners (border/theme/size/ref configurable). */
export function buildPollEmbedSnippet({
  pollId,
  origin,
  title = 'Folkets Meninger: avstemning',
  options = {},
  autoHeight = true,
}: PollEmbedSnippetInput): string {
  const src = buildPollEmbedUrl(pollId, origin, options);
  const height = options.size === 'compact' ? 220 : 440;
  const iframe = `<iframe src="${escapeHtmlAttr(src)}" title="${escapeHtmlAttr(title)}" width="100%" height="${height}" loading="lazy" style="border:0;width:100%;max-width:640px" referrerpolicy="strict-origin-when-cross-origin" data-fm-embed></iframe>`;
  if (!autoHeight) return iframe;
  const scriptSrc = new URL('/embed.js', `${normalizeOrigin(origin)}/`).toString();
  return `${iframe}\n<script async src="${escapeHtmlAttr(scriptSrc)}"></script>`;
}

/**
 * Deep-link a poll into the native share sheets of Reddit / Facebook /
 * LinkedIn / X. All targets take a share URL; Reddit and X also take text.
 */
export function buildPollShareTargetUrl(
  target: PollShareTarget,
  input: { url: string; title?: string },
): string {
  const url = input.url;
  const title = input.title ?? 'Folkets Meninger';
  switch (target) {
    case 'reddit': {
      const params = new URLSearchParams({ url, title });
      return `https://www.reddit.com/submit?${params.toString()}`;
    }
    case 'facebook': {
      const params = new URLSearchParams({ u: url });
      return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
    }
    case 'linkedin': {
      const params = new URLSearchParams({ url });
      return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
    }
    case 'x': {
      const params = new URLSearchParams({ url, text: title });
      return `https://x.com/intent/post?${params.toString()}`;
    }
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

/** Short share copy used for native share + social posts. */
export function buildPollShareText(title: string): string {
  const clean = title.trim();
  return `${clean} Hva mener du? Svar ${POLL_BALLOT_OPTIONS_PHRASE}.`;
}
