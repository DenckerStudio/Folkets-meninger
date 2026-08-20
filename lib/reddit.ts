const DEFAULT_COMMUNITY = 'Folkets_meninger';
const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 10_000;
const MAX_QUOTE_LENGTH = 2_000;

export type RedditIntentKind = 'join' | 'submit' | 'quote';

export type RedditIntent = {
  kind: RedditIntentKind;
  title?: string;
  url?: string;
  quote?: string;
  sourceLabel?: string;
  next?: string;
};

export function redditCommunityName(): string {
  const raw = process.env.NEXT_PUBLIC_REDDIT_COMMUNITY?.trim();
  return raw && raw.length > 0 ? raw.replace(/^r\//i, '') : DEFAULT_COMMUNITY;
}

export function redditCommunityUrl(community = redditCommunityName()): string {
  return `https://www.reddit.com/r/${encodeURIComponent(community)}`;
}

export function clampShareTitle(title: string, max = MAX_TITLE_LENGTH): string {
  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function redditSubmitLinkUrl(input: {
  title: string;
  url: string;
  community?: string;
}): string {
  const community = input.community ?? redditCommunityName();
  const params = new URLSearchParams({
    title: clampShareTitle(input.title),
    url: input.url,
  });
  return `${redditCommunityUrl(community)}/submit?${params.toString()}`;
}

export function redditSubmitQuoteUrl(input: {
  title: string;
  url: string;
  quote: string;
  sourceLabel?: string;
  community?: string;
}): string {
  const community = input.community ?? redditCommunityName();
  const quote = input.quote.replace(/\s+/g, ' ').trim();
  const body = [
    quote ? `> ${quote}` : null,
    input.sourceLabel ? `Kilde: ${input.sourceLabel}` : null,
    `Sak: ${input.url}`,
    '',
    'Startet fra Folkets Stemme — nøytral saksoversikt fra Stortinget.',
  ]
    .filter((line) => line != null)
    .join('\n');

  const params = new URLSearchParams({
    title: clampShareTitle(input.title),
    type: 'TEXT',
    text: body.slice(0, MAX_TEXT_LENGTH),
  });
  return `${redditCommunityUrl(community)}/submit?${params.toString()}`;
}

export function redditOAuthStartPath(input: RedditIntent): string {
  const params = new URLSearchParams();
  params.set('intent', input.kind);
  if (input.title) params.set('title', clampShareTitle(input.title));
  if (input.url) params.set('url', input.url.trim());
  if (input.quote) params.set('quote', input.quote.replace(/\s+/g, ' ').trim().slice(0, MAX_QUOTE_LENGTH));
  if (input.sourceLabel) params.set('source', input.sourceLabel.trim().slice(0, 120));
  if (input.next) params.set('next', input.next);
  return `/api/reddit/start?${params.toString()}`;
}

export function parseRedditIntentKind(value: string | null): RedditIntentKind {
  if (value === 'join' || value === 'submit' || value === 'quote') return value;
  return 'join';
}

export function parseRedditIntentFromSearch(search: URLSearchParams): RedditIntent {
  const kind = parseRedditIntentKind(search.get('intent'));
  const title = search.get('title')?.trim() || undefined;
  const url = search.get('url')?.trim() || undefined;
  const quote = search.get('quote')?.trim() || undefined;
  const sourceLabel = search.get('source')?.trim() || undefined;
  const next = search.get('next')?.trim() || undefined;

  if (kind === 'quote' && title && url && quote) {
    return { kind, title, url, quote, sourceLabel, next };
  }
  if (kind === 'submit' && title && url) {
    return { kind: 'submit', title, url, next };
  }
  return { kind: 'join', next };
}

export function absolutizeRedditIntent(origin: string, intent: RedditIntent): RedditIntent {
  const base = origin.replace(/\/$/, '');
  const url = intent.url?.trim();
  if (!url) return intent;
  if (url.startsWith('/')) {
    return { ...intent, url: `${base}${url}` };
  }
  if (url.startsWith(`${base}/`)) return intent;
  return { ...intent, url: undefined };
}

export function redditDestinationForIntent(intent: RedditIntent): string {
  switch (intent.kind) {
    case 'submit':
      if (intent.title && intent.url) {
        return redditSubmitLinkUrl({ title: intent.title, url: intent.url });
      }
      return redditCommunityUrl();
    case 'quote':
      if (intent.title && intent.url && intent.quote) {
        return redditSubmitQuoteUrl({
          title: intent.title,
          url: intent.url,
          quote: intent.quote,
          sourceLabel: intent.sourceLabel,
        });
      }
      return redditCommunityUrl();
    case 'join':
      return intent.next && intent.next.startsWith('/') ? intent.next : redditCommunityUrl();
    default: {
      const _exhaustive: never = intent.kind;
      return _exhaustive;
    }
  }
}
