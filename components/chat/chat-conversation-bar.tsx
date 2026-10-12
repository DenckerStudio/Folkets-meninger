'use client';

import { useState } from 'react';
import { MessageSquarePlus, Trash2, History } from 'lucide-react';
import type { StoredConversation } from '@/lib/chat/conversations';

/**
 * Compact local conversation switcher: start a new chat, load a previous one, or delete.
 * Conversations live in this browser only (localStorage).
 */
export function ChatConversationBar({
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

  return (
    <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
      <button
        type="button"
        data-chat-action="new-chat"
        onClick={onNewChat}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MessageSquarePlus className="size-3.5" aria-hidden />
        Ny samtale
      </button>

      {conversations.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            data-chat-action="toggle-history"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={open}
          >
            <History className="size-3.5" aria-hidden />
            Samtaler ({conversations.length})
          </button>

          {open ? (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-72 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${
                    conversation.id === activeId ? 'bg-brand/10' : 'hover:bg-muted'
                  }`}
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
        </div>
      ) : null}
    </div>
  );
}
