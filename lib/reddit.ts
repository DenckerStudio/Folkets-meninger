const DEFAULT_COMMUNITY = 'FolketsMeninger';
const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 10_000;

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
