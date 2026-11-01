'use client';

import { PollShareButton, type PollShareButtonProps } from '@/components/polls/poll-share-button';
import { useReelExpandedShareDialog } from '@/components/polls/reel-expanded-share-context';

/** Reel-only Del control — delete this file with Reels (#253) without touching PollShareButton. */
export type ReelPollShareDelProps = Omit<PollShareButtonProps, 'onDialogOpenChange' | 'overlayTop'>;

export function ReelPollShareDel(props: ReelPollShareDelProps) {
  const reelShare = useReelExpandedShareDialog();

  return (
    <PollShareButton
      {...props}
      overlayTop
      onDialogOpenChange={(open) => reelShare?.setShareDialogOpen(open)}
    />
  );
}
