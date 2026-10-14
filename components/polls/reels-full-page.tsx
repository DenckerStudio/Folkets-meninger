'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReelsPanel } from '@/components/polls/utforsk-reels-stage';
import type { SystemReelFeedItem } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

type ReelsFullPageProps = {
  items: SystemReelFeedItem[];
  initialPollId?: string;
};

export default function ReelsFullPage({ items, initialPollId }: ReelsFullPageProps) {
  const router = useRouter();
  // Deep link centres the requested card; it does not flip it into vote mode
  // (vote mode locks the carousel and left the arrows disabled at 1/N).
  const [activePollId, setActivePollId] = useState<string | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    html.setAttribute('data-reels-open', '');
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.removeAttribute('data-reels-open');
      html.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const handleClose = () => {
    router.push(routes.utforsk);
  };

  return (
    <div
      role="dialog"
      aria-label="Reels"
      className="fixed inset-0 z-[200] flex h-[100dvh] w-screen flex-col bg-[#00205b]"
      style={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <ReelsPanel
        active={true}
        items={items}
        activePollId={activePollId}
        initialPollId={initialPollId ?? null}
        onSelect={setActivePollId}
        onClose={handleClose}
      />
    </div>
  );
}