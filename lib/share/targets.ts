/**
 * Share targets used by the share dialog (`components/share/share-dialog.tsx`).
 * X and Reddit are deliberately not offered (dropped for now, see AGENTS.md).
 */

export type ShareTarget = 'facebook' | 'linkedin' | 'bluesky' | 'whatsapp' | 'sms' | 'email';
export type ShareChannel = ShareTarget | 'native' | 'copy';

export const SHARE_TARGETS: ShareTarget[] = [
  'facebook',
  'linkedin',
  'bluesky',
  'whatsapp',
  'sms',
  'email',
];

export const SHARE_TARGET_LABELS: Record<ShareTarget, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  bluesky: 'Bluesky',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'E-post',
};

export type ShareTargetInput = {
  url: string;
  title: string;
  /** Short message placed before the link where the target supports text. */
  text?: string;
};

function messageWithUrl(text: string, url: string): string {
  const clean = text.trim();
  return clean ? `${clean}\n${url}` : url;
}

/** Deep link into the target's own share flow. All targets get the URL; most also get text. */
export function buildShareTargetUrl(target: ShareTarget, input: ShareTargetInput): string {
  const { url, title } = input;
  const text = (input.text ?? title).trim();
  switch (target) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}`;
    case 'bluesky':
      return `https://bsky.app/intent/compose?${new URLSearchParams({ text: messageWithUrl(text, url) })}`;
    case 'whatsapp':
      return `https://wa.me/?${new URLSearchParams({ text: messageWithUrl(text, url) })}`;
    case 'sms':
      // `?&body=` is the form both iOS and Android Messages accept.
      return `sms:?&body=${encodeURIComponent(messageWithUrl(text, url))}`;
    case 'email': {
      const subject = encodeURIComponent(title.trim());
      const body = encodeURIComponent(messageWithUrl(text, url));
      return `mailto:?subject=${subject}&body=${body}`;
    }
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

/** Social targets open a new tab; app-scheme targets (SMS, e-post) open in place. */
export function shareTargetOpensNewTab(target: ShareTarget): boolean {
  return target !== 'sms' && target !== 'email';
}

/** Resolve a root-relative path against the browser origin (client) or return as-is. */
export function resolveShareUrl(url: string, origin?: string | null): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : null);
  if (!base) return url;
  return new URL(url.startsWith('/') ? url : `/${url}`, `${base}/`).toString();
}

/** Host shown in the preview card, e.g. `folkets-meninger.no`. */
export function shareDisplayHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}
