'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChatOrb } from '@/components/chat/chat-orb';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { shouldOpenChatFromSearchParams } from '@/lib/chat/overlay';

function ChatUrlBridge() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { openChat } = useChatOverlay();

  useEffect(() => {
    if (!shouldOpenChatFromSearchParams(searchParams)) return;
    const sak = searchParams.get('sak')?.trim();
    openChat(sak ? { issueId: sak } : null);

    const next = new URLSearchParams(searchParams.toString());
    next.delete('chat');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [openChat, pathname, router, searchParams]);

  return null;
}

export function ChatHost() {
  return (
    <>
      <ChatOrb />
      <ChatPanel />
      <Suspense fallback={null}>
        <ChatUrlBridge />
      </Suspense>
    </>
  );
}
