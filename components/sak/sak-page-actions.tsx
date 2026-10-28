'use client';

import { ShareTrigger } from '@/components/share/share-trigger';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { routes } from '@/lib/routes';

type SakPageActionsProps = {
  sakId: string;
  title: string;
  description?: string;
  className?: string;
};

export function SakPageActions({ sakId, title, description, className = '' }: SakPageActionsProps) {
  const { openChat } = useChatOverlay();
  const sakUrl = routes.sak(sakId);

  return (
    <nav
      aria-label="Sakshandlinger"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`.trim()}
    >
      <ShareTrigger
        label="Del sak"
        dialogTitle="Del saken"
        url={sakUrl}
        title={title}
        text={`Se denne saken på Folkets Meninger: ${title}`}
        description={description}
        previewImageUrl={`${sakUrl}/opengraph-image`}
      />
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
