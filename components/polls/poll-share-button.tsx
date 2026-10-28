'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ShareTrigger } from '@/components/share/share-trigger';
import { buildPollShareChannelUrl, buildPollShareText, pollSharePath } from '@/lib/polls/share';
import { routes } from '@/lib/routes';
import type { ShareChannel } from '@/lib/share/targets';

type PollShareButtonProps = {
  pollId: string;
  title: string;
  description?: string;
  /** Public `/del` landing is live (flag on, or admin preview). Otherwise share the dashboard page. */
  sharePageEnabled: boolean;
  className?: string;
};

export function PollShareButton({
  pollId,
  title,
  description,
  sharePageEnabled,
  className,
}: PollShareButtonProps) {
  const pagePath = sharePageEnabled ? pollSharePath(pollId) : routes.poll(pollId);

  const channelUrl = useCallback(
    (channel: ShareChannel) => {
      if (!sharePageEnabled) return pagePath;
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      return buildPollShareChannelUrl(pollId, origin, channel);
    },
    [pagePath, pollId, sharePageEnabled],
  );

  return (
    <ShareTrigger
      label="Del"
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
