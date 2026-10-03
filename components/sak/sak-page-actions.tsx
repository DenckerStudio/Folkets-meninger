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
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`.trim()}
    >
      <ShareButton id={sakId} title={title} />
      <button
        type="button"
        onClick={() => openChat({ issueId: sakId, issueTitle: title })}
        className="text-brand hover:underline"
      >
        Spør AI
      </button>
    </nav>
  );
}
