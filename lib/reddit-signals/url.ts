const REDDIT_ID_PATTERN = /^[a-z0-9]{1,12}$/;

export function isValidRedditId(value: string): boolean {
  return REDDIT_ID_PATTERN.test(value);
}

/** Canonical discussion URL — built server-side only. */
export function buildRedditCommentsUrl(redditId: string): string {
  if (!isValidRedditId(redditId)) {
    throw new Error('Ugyldig reddit_id');
  }
  return `https://www.reddit.com/comments/${redditId}/`;
}
