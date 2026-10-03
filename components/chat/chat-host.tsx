'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChatOrb } from '@/components/chat/chat-orb';
import { ChatPanel } from '@/components/chat/chat-panel';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { issueIdFromPathname, shouldOpenChatFromSearchParams } from '@/lib/chat/overlay';

function ChatUrlBridge() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { open, openChat } = useChatOverlay();
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) wasOpen.current = true;
  }, [open]);

  useEffect(() => {
    if (!shouldOpenChatFromSearchParams(searchParams)) return;
    const sak = searchParams.get('sak')?.trim() || issueIdFromPathname(pathname);
    openChat(sak ? { issueId: sak } : null);
  }, [openChat, pathname, searchParams]);

  useEffect(() => {
    if (open || !wasOpen.current || !shouldOpenChatFromSearchParams(searchParams)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('chat');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [open, pathname, router, searchParams]);

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
