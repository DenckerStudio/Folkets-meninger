import type { PollRecord } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

export type ReelPollSourceLink = {
  href: string;
  label: string;
  external: boolean;
};

/** Sak link + poll source URLs, deduped like avstemning detail. */
export function listReelPollSourceLinks(poll: PollRecord): ReelPollSourceLink[] {
  const links: ReelPollSourceLink[] = [];
  const sakUrl = poll.stortingetIssueId ? routes.sak(poll.stortingetIssueId) : null;

  if (poll.stortingetIssueId && sakUrl) {
    links.push({
      href: sakUrl,
      label: `Stortingssak ${poll.stortingetIssueId}`,
      external: false,
    });
  }

  for (const source of poll.sourceUrls) {
    if (sakUrl && source.url === sakUrl) continue;
    links.push({
      href: source.url,
      label: source.label?.trim() || source.url,
      external: true,
    });
  }

  return links;
}
