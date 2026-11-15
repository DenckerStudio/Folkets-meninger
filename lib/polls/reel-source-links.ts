import type { PollRecord } from '@/lib/polls/types';
import { resolvePollSourceSakLink } from '@/lib/polls/stortinget-issue-link';

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
  const sakLink = resolvePollSourceSakLink(poll.stortingetIssueId);

  if (sakLink) {
    seen.add(sakLink.href);
    links.push({
      id: `sak-${sakLink.kind}-${poll.stortingetIssueId ?? 'none'}`,
      href: sakLink.href,
      label:
        sakLink.kind === 'stortinget'
          ? `Stortingssak ${poll.stortingetIssueId}`
          : sakLink.label,
      external: false,
    });
  }

  for (const source of poll.sourceUrls) {
    if (!isHttpUrl(source.url)) continue;
    const normalized = normalizeHttpUrl(source.url);
    if (sakLink && normalized === sakLink.href) continue;
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
