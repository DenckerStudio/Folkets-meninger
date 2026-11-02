import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_PATH,
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
import type { PollRecord, PollTotals } from '@/lib/polls/types';
import {
  SYSTEM_POLL_SHARE_RETIRED_LEAD,
  SYSTEM_POLL_SHARE_RETIRED_TITLE,
} from '@/lib/polls/system-reels-retired';

export function pollOpenGraphImagePath(pollId: string): string {
  return `${routes.poll(pollId)}/opengraph-image`;
}

/** Cache-bust OG image URLs when Nei/Blank/Ja counts change (social crawlers). */
export function pollOgImageVersionFromTotals(totals: PollTotals): string {
  const payload = `${totals.nei}:${totals.blank}:${totals.ja}`;
  return createHash('sha256').update(payload).digest('hex').slice(0, 12);
}

export function pollOpenGraphImageUrl(pollId: string, totals: PollTotals): string {
  const base = pollOpenGraphImagePath(pollId);
  return `${base}?v=${pollOgImageVersionFromTotals(totals)}`;
}

export function delOpenGraphImageUrl(pollId: string, totals: PollTotals): string {
  const base = `${pollSharePath(pollId)}/opengraph-image`;
  return `${base}?v=${pollOgImageVersionFromTotals(totals)}`;
}

export function buildPollDetailPageMetadata(poll: PollRecord, totals: PollTotals): Metadata {
  const title = formatPollDisplayTitle(poll.title);
  const imageUrl = pollOpenGraphImageUrl(poll.id, totals);
  const imageAlt = pollOgImageAlt(poll.title, totals);
  const base = buildPageMetadata({
    title,
    description: truncateDescription(
      poll.neutralSummary || `${title} — stem ${pollBallotRunningTextPhrase()}.`,
    ),
    canonicalPath: routes.poll(poll.id),
    images: [imageUrl],
  });
  const imageSpec = { url: imageUrl, ...OG_IMAGE_SIZE, alt: imageAlt };
  return {
    ...base,
    openGraph: {
      ...(base.openGraph as object),
      images: [imageSpec],
    },
    twitter: {
      ...(base.twitter as object),
      images: [imageSpec],
    },
  };
}

/** Metadata for retired system polls on `/dashboard/avstemninger/[id]` (no ballot, noindex). */
export function buildRetiredPollDetailPageMetadata(pollId: string): Metadata {
  const canonical = routes.poll(pollId);
  const title = `${SYSTEM_POLL_SHARE_RETIRED_TITLE} – ${SITE_NAME}`;
  const description = SYSTEM_POLL_SHARE_RETIRED_LEAD;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      title: SYSTEM_POLL_SHARE_RETIRED_TITLE,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: SYSTEM_POLL_SHARE_RETIRED_TITLE,
      description,
    },
  };
}

/** Metadata for retired system-Reels on `/del/[id]` (no ballot, noindex). */
export function buildRetiredDelSharePageMetadata(pollId: string): Metadata {
  const canonical = pollSharePath(pollId);
  const title = `${SYSTEM_POLL_SHARE_RETIRED_TITLE} – ${SITE_NAME}`;
  const description = SYSTEM_POLL_SHARE_RETIRED_LEAD;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      title: SYSTEM_POLL_SHARE_RETIRED_TITLE,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: SYSTEM_POLL_SHARE_RETIRED_TITLE,
      description,
    },
  };
}

/** Neutral `/del/[id]` metadata when the share route is disabled (404 for non-admins). */
export function buildDisabledDelSharePageMetadata(): Metadata {
  const description = DEFAULT_DESCRIPTION;
  const image = {
    url: DEFAULT_OG_IMAGE_PATH,
    ...OG_IMAGE_SIZE,
    alt: SITE_NAME,
  };
  return {
    title: SITE_NAME,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: SITE_NAME,
      description,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_NAME,
      description,
      images: [image],
    },
  };
}

type DelShareMetadataInput = {
  poll: PollRecord | null;
  pollId: string;
  totals: PollTotals | null;
};

/** Metadata for public `/del/[id]` share landing (OG title without brand suffix). */
export function buildDelSharePageMetadata({ poll, pollId, totals }: DelShareMetadataInput): Metadata {
  const shareable = Boolean(poll && isShareablePoll(poll));

  const title = shareable && poll ? poll.title : SITE_NAME;
  const description =
    shareable && poll
      ? poll.neutralSummary.trim()
        ? truncateDescription(poll.neutralSummary, 155)
        : `Stem ${pollBallotRunningTextPhrase()}. Se hva andre mener på Folkets Meninger.`
      : DEFAULT_DESCRIPTION;

  const canonical = pollSharePath(pollId);
  const imagePath =
    shareable && poll && totals
      ? delOpenGraphImageUrl(pollId, totals)
      : `${canonical}/opengraph-image`;
  const image = {
    url: imagePath,
    ...OG_IMAGE_SIZE,
    alt: shareable && poll && totals ? pollOgImageAlt(poll.title, totals) : OG_IMAGE_ALT,
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
