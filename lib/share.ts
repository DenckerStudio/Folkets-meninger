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

export function sakAbsoluteUrl(origin: string, sakId: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${routes.sak(sakId)}`;
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
