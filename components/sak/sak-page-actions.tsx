'use client';

import ShareButton from '@/app/dashboard/sak/[id]/share-button';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';

type SakPageActionsProps = {
  sakId: string;
  title: string;
  className?: string;
};

export function SakPageActions({ sakId, title, className = '' }: SakPageActionsProps) {
  const { openChat } = useChatOverlay();

  return (
    <nav
      aria-label="Sakshandlinger"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`.trim()}
    >
      <ShareButton id={sakId} title={title} />
      <button
        type="button"
        onClick={() => openChat({ issueId: sakId, issueTitle: title })}
        className="inline-flex min-h-11 items-center rounded-xl px-3 text-brand transition-colors hover:bg-brand/10 hover:underline"
      >
        Spør Stemme+
      </button>
    </nav>
  );
}
