'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ChatIssueContext } from '@/lib/chat/overlay';

type ChatOverlayValue = {
  open: boolean;
  issue: ChatIssueContext | null;
  openChat: (issue?: ChatIssueContext | null) => void;
  closeChat: () => void;
};

const ChatOverlayContext = createContext<ChatOverlayValue | null>(null);

export function ChatOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<ChatIssueContext | null>(null);

  const openChat = useCallback((nextIssue?: ChatIssueContext | null) => {
    setIssue(nextIssue ?? null);
    setOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo(
    () => ({ open, issue, openChat, closeChat }),
    [open, issue, openChat, closeChat],
  );

  return <ChatOverlayContext.Provider value={value}>{children}</ChatOverlayContext.Provider>;
}

export function useChatOverlay(): ChatOverlayValue {
  const value = useContext(ChatOverlayContext);
  if (!value) {
    throw new Error('useChatOverlay må brukes inne i ChatOverlayProvider');
  }
  return value;
}
