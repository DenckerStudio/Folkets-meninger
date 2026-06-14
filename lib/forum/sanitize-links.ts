const ALLOWED_HOST_SUFFIXES = [
  'folketsstemme.no',
  'stortinget.no',
  'regjeringen.no',
  'nrk.no',
  'vg.no',
  'dagbladet.no',
  'aftenposten.no',
  'data.stortinget.no',
] as const;

const BLOCKED_HOST_FRAGMENTS = [
  'porn',
  'xxx',
  'xnxx',
  'xvideos',
  'redtube',
  'youporn',
  'hentai',
  'casino',
  'bet365',
  'warez',
  'torrent',
] as const;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const MAX_URLS = 10;

export type SanitizedUrl = {
  url: string;
  host: string;
  isExternal: boolean;
  isAllowed: boolean;
};

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

export function isInternalDashboardPath(value: string): boolean {
  return value.startsWith('/dashboard/') && !value.includes('..');
}

export function isAllowedHost(host: string): boolean {
  const h = normalizeHost(host);
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => h === suffix || h.endsWith(`.${suffix}`)
  );
}

export function isBlockedHost(host: string): boolean {
  const h = normalizeHost(host);
  return BLOCKED_HOST_FRAGMENTS.some((frag) => h.includes(frag));
}

export function parseUrl(raw: string): SanitizedUrl | null {
  const trimmed = raw.replace(/[.,;:!?)]+$/, '');
  if (isInternalDashboardPath(trimmed)) {
    return { url: trimmed, host: '', isExternal: false, isAllowed: true };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { url: trimmed, host: parsed.hostname, isExternal: true, isAllowed: false };
    }
    const host = parsed.hostname;
    if (isBlockedHost(host)) {
      return { url: trimmed, host, isExternal: true, isAllowed: false };
    }
    return {
      url: trimmed,
      host,
      isExternal: true,
      isAllowed: isAllowedHost(host),
    };
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  const paths = text.match(/\/dashboard\/[^\s<>"')\]]+/g) ?? [];
  return [...matches, ...paths].slice(0, MAX_URLS * 2);
}

export function validateUrlsInText(text: string): { ok: true } | { ok: false; error: string } {
  const urls = extractUrls(text);
  if (urls.length > MAX_URLS) {
    return { ok: false, error: `Maks ${MAX_URLS} lenker per innlegg` };
  }

  for (const raw of urls) {
    const parsed = parseUrl(raw);
    if (!parsed) continue;
    if (!parsed.isAllowed) {
      return { ok: false, error: 'Lenken er ikke tillatt på Folkets Stemme' };
    }
  }

  if (/javascript:/i.test(text) || /<script/i.test(text)) {
    return { ok: false, error: 'Ugyldig innhold i innlegget' };
  }

  return { ok: true };
}

export function sanitizeForumBody(text: string): string {
  return text
    .replace(/\0/g, '')
    .replace(/javascript:/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .trim();
}
