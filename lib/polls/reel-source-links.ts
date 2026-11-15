import type { PollRecord } from '@/lib/polls/types';
import { pollPublicStortingetIssueId, pollSakDashboardHref } from '@/lib/polls/stortinget-issue-link';

export type ReelPollSourceLink = {
  id: string;
  href: string;
  label: string;
  external: boolean;
};

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeHttpUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.href.replace(/\/$/, '');
}

/** Sak link + http(s) poll source URLs, deduped on normalized URL. */
export function listReelPollSourceLinks(poll: PollRecord): ReelPollSourceLink[] {
  const links: ReelPollSourceLink[] = [];
  const seen = new Set<string>();
  const publicIssueId = pollPublicStortingetIssueId(poll.stortingetIssueId);
  const sakUrl = pollSakDashboardHref(poll.stortingetIssueId);

  if (publicIssueId && sakUrl) {
    seen.add(sakUrl);
    links.push({
      id: `sak-${publicIssueId}`,
      href: sakUrl,
      label: `Stortingssak ${publicIssueId}`,
      external: false,
    });
  }

  for (const source of poll.sourceUrls) {
    if (!isHttpUrl(source.url)) continue;
    const normalized = normalizeHttpUrl(source.url);
    if (sakUrl && normalized === sakUrl) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push({
      id: `src-${normalized}`,
      href: source.url,
      label: source.label?.trim() || source.url,
      external: true,
    });
  }

  return links;
}
