'use client';

import { useEffect, useRef, useState } from 'react';
import { History, MessageSquarePlus, Trash2 } from 'lucide-react';
import type { StoredConversation } from '@/lib/chat/conversations';
import { cn } from '@/lib/utils';

/**
 * Compact conversation controls for the chat card header: start a new chat and
 * (when history exists) open a menu of previous local conversations. Keeps the
 * message body free of chrome. Conversations live in this browser only.
 */
export function ChatConversationMenu({
  conversations,
  activeId,
  disabled,
  onNewChat,
  onSelect,
  onDelete,
}: {
  conversations: StoredConversation[];
  activeId: string | null;
  disabled?: boolean;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const iconButton =
    'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div ref={containerRef} className="relative flex items-center gap-0.5">
      <button
        type="button"
        data-chat-action="new-chat"
        aria-label="Ny samtale"
        title="Ny samtale"
        onClick={onNewChat}
        disabled={disabled}
        className={iconButton}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
      </button>

      {conversations.length > 0 ? (
        <>
          <button
            type="button"
            data-chat-action="toggle-history"
            aria-label={`Samtaler (${conversations.length})`}
            title="Tidligere samtaler"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={cn(iconButton, open && 'bg-muted text-foreground')}
          >
            <History className="size-4" aria-hidden />
          </button>

          {open ? (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs',
                    conversation.id === activeId ? 'bg-brand/10' : 'hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(conversation.id);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 truncate text-left font-medium text-foreground"
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    aria-label={`Slett samtale: ${conversation.title}`}
                    onClick={() => onDelete(conversation.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
