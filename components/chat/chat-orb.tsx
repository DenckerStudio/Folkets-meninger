'use client';

import { usePathname } from 'next/navigation';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { issueIdFromPathname } from '@/lib/chat/overlay';
import './chat-orb.css';

/** Kompakt Stemme+-pill som åpner chat-overlayet (ikke orb). */
export function ChatOrb() {
  const pathname = usePathname();
  const { open, openChat, closeChat } = useChatOverlay();

  return (
    <button
      type="button"
      className="chat-orb"
      data-chat-orb=""
      data-open={open ? 'true' : 'false'}
      aria-expanded={open}
      aria-controls="stemme-chat-panel"
      aria-label={open ? 'Lukk chat' : 'Åpne Stemme+'}
      onClick={() => {
        if (open) closeChat();
        else {
          const sak = issueIdFromPathname(pathname);
          openChat(sak ? { issueId: sak } : null);
        }
      }}
    >
      Stemme+
    </button>
  );
}
