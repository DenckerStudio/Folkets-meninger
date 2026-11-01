'use client';

import Link from 'next/link';
import { useCallback } from 'react';
import { ShareButton } from '@/components/share/share-button';
import { buildPollPageShareChannelUrl, buildPollShareText } from '@/lib/polls/share';
import { routes } from '@/lib/routes';
import type { ShareChannel } from '@/lib/share/targets';

type PollShareButtonProps = {
  pollId: string;
  title: string;
  description?: string;
  /** When true, show embed partner link (admin / feature flag). Share URLs always use the poll detail page. */
  sharePageEnabled: boolean;
  label?: string;
  /** Round icon trigger without visible «Del» text. */
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function PollShareButton({
  pollId,
  title,
  description,
  sharePageEnabled,
  label = 'Del',
  iconOnly = false,
  ariaLabel,
  className,
}: PollShareButtonProps) {
  const pagePath = routes.poll(pollId);

  const channelUrl = useCallback(
    (channel: ShareChannel) => buildPollPageShareChannelUrl(pollId, null, channel),
    [pollId],
  );

  return (
    <ShareButton
      label={iconOnly ? undefined : label}
      ariaLabel={ariaLabel}
      dialogTitle="Del avstemningen"
      url={pagePath}
      title={title}
      text={buildPollShareText(title)}
      description={description}
      previewImageUrl={`${pagePath}/opengraph-image`}
      channelUrl={channelUrl}
      className={className}
      extraActions={
        sharePageEnabled ? (
          <Link
            href={routes.sharePoll(pollId)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
          >
            Bygg inn på nettstedet ditt →
          </Link>
        ) : undefined
      }
    />
  );
}
