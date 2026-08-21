import { redditSubmitLinkUrl, redditSubmitQuoteUrl } from '@/lib/reddit';
import { routes } from '@/lib/routes';

export type ShareChannel = 'copy' | 'native' | 'x' | 'facebook' | 'linkedin' | 'email' | 'reddit';

export type QuoteShareDraft = {
  quote: string;
  sourceLabel?: string;
};

export type SharePayload = {
  title: string;
  url: string;
  text?: string;
  quote?: string;
  sourceLabel?: string;
};

export type SakShareMeta = {
  title: string;
  description: string;
  url: string;
};

const DEFAULT_SITE_ORIGIN = 'https://folketsstemme.no';
const OG_DESCRIPTION_MAX = 200;

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return raw && raw.length > 0 ? raw.replace(/\/$/, '') : DEFAULT_SITE_ORIGIN;
}

export function sakAbsoluteUrl(origin: string, sakId: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${routes.sak(sakId)}`;
}

export function clampShareDescription(text: string, max = OG_DESCRIPTION_MAX): string {
  const cleaned = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

export function buildSakShareDescription(input: {
  title: string;
  summary?: string | null;
  category?: string | null;
  henvisning?: string | null;
  innstillingstekst?: string | null;
  kortvedtak?: string | null;
  aiNarrative?: string | null;
}): string {
  const ai = input.aiNarrative?.trim();
  if (ai) return clampShareDescription(ai);

  const innstilling = input.innstillingstekst?.trim();
  if (innstilling) return clampShareDescription(innstilling);

  const vedtak = input.kortvedtak?.trim();
  if (vedtak) return clampShareDescription(vedtak);

  const summary = input.summary?.trim();
  if (summary && summary !== input.title) return clampShareDescription(summary);

  const bits = [
    input.henvisning?.trim() || null,
    input.category?.trim() || null,
    'Nøytral saksoversikt fra Stortinget — Folkets Stemme',
  ].filter((bit): bit is string => Boolean(bit));
  return clampShareDescription(bits.join('. '));
}

export function buildSakShareMeta(input: {
  sakId: string;
  title: string;
  description: string;
}): SakShareMeta {
  const title = input.title.replace(/\s+/g, ' ').trim() || 'Sak';
  return {
    title,
    description: clampShareDescription(input.description),
    url: sakAbsoluteUrl(siteOrigin(), input.sakId),
  };
}

export function formatQuoteShareText(input: {
  quote: string;
  title: string;
  url: string;
  sourceLabel?: string;
}): string {
  const quote = input.quote.replace(/\s+/g, ' ').trim();
  return [
    quote ? `«${quote}»` : null,
    input.sourceLabel ? `— ${input.sourceLabel}` : null,
    input.title,
    input.url,
  ]
    .filter((line) => line != null && line.length > 0)
    .join('\n');
}

export function twitterIntentUrl(payload: SharePayload): string {
  const text = payload.quote
    ? formatQuoteShareText({
        quote: payload.quote,
        title: payload.title,
        url: payload.url,
        sourceLabel: payload.sourceLabel,
      })
    : payload.text ?? payload.title;
  const params = new URLSearchParams({ text, url: payload.url });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function facebookShareUrl(url: string): string {
  return `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url }).toString()}`;
}

export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url }).toString()}`;
}

export function emailShareUrl(payload: SharePayload): string {
  const body = payload.quote
    ? formatQuoteShareText({
        quote: payload.quote,
        title: payload.title,
        url: payload.url,
        sourceLabel: payload.sourceLabel,
      })
    : `${payload.text ?? payload.title}\n\n${payload.url}`;
  return `mailto:?${new URLSearchParams({
    subject: payload.title,
    body,
  }).toString()}`;
}

export function shareChannelUrl(channel: ShareChannel, payload: SharePayload): string | null {
  switch (channel) {
    case 'x':
      return twitterIntentUrl(payload);
    case 'facebook':
      return facebookShareUrl(payload.url);
    case 'linkedin':
      return linkedInShareUrl(payload.url);
    case 'email':
      return emailShareUrl(payload);
    case 'reddit':
      return payload.quote
        ? redditSubmitQuoteUrl({
            title: payload.title,
            url: payload.url,
            quote: payload.quote,
            sourceLabel: payload.sourceLabel,
          })
        : redditSubmitLinkUrl({ title: payload.title, url: payload.url });
    case 'copy':
    case 'native':
      return null;
    default: {
      const _exhaustive: never = channel;
      return _exhaustive;
    }
  }
}
