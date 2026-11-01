import type { Metadata } from 'next';
import {
  DEFAULT_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  buildPageMetadata,
  truncateDescription,
} from '@/lib/seo/metadata';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import { OG_IMAGE_ALT, OG_IMAGE_SIZE, pollOgImageAlt } from '@/lib/polls/share-og';
import { isShareablePoll, pollSharePath } from '@/lib/polls/share';
import { routes } from '@/lib/routes';
import type { PollRecord } from '@/lib/polls/types';

export function pollOpenGraphImagePath(pollId: string, basePath?: string): string {
  const prefix = basePath ?? routes.poll(pollId);
  return `${prefix}/opengraph-image`;
}

export function buildPollDetailPageMetadata(poll: PollRecord): Metadata {
  const title = formatPollDisplayTitle(poll.title);
  return buildPageMetadata({
    title,
    description: truncateDescription(
      poll.neutralSummary || `${title} — stem ${pollBallotRunningTextPhrase()}.`,
    ),
    canonicalPath: routes.poll(poll.id),
    images: [pollOpenGraphImagePath(poll.id)],
  });
}

export function buildUtforskReelPollMetadata(poll: PollRecord): Metadata {
  const title = formatPollDisplayTitle(poll.title);
  return buildPageMetadata({
    title,
    description: truncateDescription(
      poll.neutralSummary ||
        `Systemgenerert Reel. Stem ${pollBallotRunningTextPhrase()} på Folkets Meninger.`,
    ),
    canonicalPath: routes.utforskReels(poll.id),
    images: [pollOpenGraphImagePath(poll.id)],
  });
}

type DelShareMetadataInput = {
  poll: PollRecord | null;
  pollId: string;
};

/** Metadata for public `/del/[id]` share landing (OG title without brand suffix). */
export function buildDelSharePageMetadata({ poll, pollId }: DelShareMetadataInput): Metadata {
  const shareable = Boolean(poll && isShareablePoll(poll));

  const title = shareable && poll ? poll.title : SITE_NAME;
  const description =
    shareable && poll
      ? poll.neutralSummary.trim()
        ? truncateDescription(poll.neutralSummary, 155)
        : `Stem ${pollBallotRunningTextPhrase()}. Se hva andre mener på Folkets Meninger.`
      : DEFAULT_DESCRIPTION;

  const canonical = pollSharePath(pollId);
  const version = shareable && poll ? poll.updatedAt : 'generic';
  const image = {
    url: `${canonical}/opengraph-image?v=${encodeURIComponent(version)}`,
    ...OG_IMAGE_SIZE,
    alt: shareable && poll ? pollOgImageAlt(poll.title) : OG_IMAGE_ALT,
  };

  return {
    title: shareable && poll ? `${poll.title} – ${SITE_NAME}` : SITE_NAME,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
