export type ReferrerBucket =
  | 'direct'
  | 'search_google'
  | 'search_other'
  | 'social_facebook'
  | 'social_bluesky'
  | 'social_linkedin'
  | 'social_whatsapp'
  | 'email'
  | 'other';

const SITE_HOST = 'folkets-meninger.no';

function bucketFromUtmSource(raw: string): ReferrerBucket {
  const source = raw.trim().toLowerCase();
  switch (source) {
    case 'facebook':
      return 'social_facebook';
    case 'linkedin':
      return 'social_linkedin';
    case 'bluesky':
      return 'social_bluesky';
    case 'whatsapp':
      return 'social_whatsapp';
    case 'email':
      return 'email';
    case 'sms':
    case 'copy':
    case 'native':
    case 'embed':
    case 'reddit':
    case 'twitter':
    case 'x':
      return 'other';
    default:
      return 'other';
  }
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

function isSameSiteHost(host: string): boolean {
  const h = stripWww(host);
  return h === SITE_HOST || h.endsWith(`.${SITE_HOST}`);
}

function isGoogleSearchHost(host: string): boolean {
  const h = stripWww(host);
  if (h === 'mail.google.com') {
    return false;
  }
  if (h === 'google.com' || h === 'google.no') {
    return true;
  }
  if (h.endsWith('.google.com') || h.endsWith('.google.no')) {
    return true;
  }
  return false;
}

function isOtherSearchHost(host: string): boolean {
  const h = stripWww(host);
  const searchHosts = ['bing.com', 'duckduckgo.com', 'ecosia.org', 'startpage.com'];
  return searchHosts.some(
    (needle) => h === needle || h.endsWith(`.${needle}`),
  );
}

function isFacebookHost(host: string): boolean {
  const h = stripWww(host);
  if (h === 'fb.com') return true;
  if (h === 'facebook.com') return true;
  return h.endsWith('.facebook.com');
}

function isLinkedInHost(host: string): boolean {
  const h = stripWww(host);
  return h === 'linkedin.com' || h.endsWith('.linkedin.com');
}

function isBlueskyHost(host: string): boolean {
  const h = stripWww(host);
  return h === 'bsky.app' || h.endsWith('.bsky.app');
}

function isWhatsappHost(host: string): boolean {
  const h = stripWww(host);
  return h === 'wa.me' || h === 'whatsapp.com' || h.endsWith('.whatsapp.com');
}

function isEmailReferrerHost(host: string, pathname: string): boolean {
  const h = stripWww(host);
  if (h === 'mail.google.com' && pathname.toLowerCase().includes('/mail')) {
    return true;
  }
  return false;
}

function bucketFromReferrerUrl(referrerUrl: string): ReferrerBucket {
  let parsed: URL;
  try {
    parsed = new URL(referrerUrl.trim());
  } catch {
    return 'direct';
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  if (!host || isSameSiteHost(host)) {
    return 'direct';
  }

  if (isEmailReferrerHost(host, pathname)) {
    return 'email';
  }
  if (isGoogleSearchHost(host)) {
    return 'search_google';
  }
  if (isOtherSearchHost(host)) {
    return 'search_other';
  }
  if (isFacebookHost(host)) {
    return 'social_facebook';
  }
  if (isBlueskyHost(host)) {
    return 'social_bluesky';
  }
  if (isLinkedInHost(host)) {
    return 'social_linkedin';
  }
  if (isWhatsappHost(host)) {
    return 'social_whatsapp';
  }

  return 'other';
}

export function classifyReferrer(input: {
  referrerUrl?: string | null;
  utmSource?: string | null;
}): { bucket: ReferrerBucket } {
  const utm = input.utmSource?.trim();
  if (utm) {
    return { bucket: bucketFromUtmSource(utm) };
  }

  const referrer = input.referrerUrl?.trim();
  if (!referrer) {
    return { bucket: 'direct' };
  }

  return { bucket: bucketFromReferrerUrl(referrer) };
}
