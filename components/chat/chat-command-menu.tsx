'use client';

import { Command, CornerDownLeft } from 'lucide-react';
import type { ChatCommand } from '@/lib/chat/commands';
import { cn } from '@/lib/utils';

type ChatCommandMenuProps = {
  id: string;
  commands: ChatCommand[];
  activeIndex: number;
  onSelect: (command: ChatCommand) => void;
  onActiveIndexChange: (index: number) => void;
  className?: string;
};

/**
 * Keyboard-navigable `/` menu for the chat composer. Purely presentational —
 * the owner keeps the active index and applies the chosen command.
 */
export function ChatCommandMenu({
  id,
  commands,
  activeIndex,
  onSelect,
  onActiveIndexChange,
  className,
}: ChatCommandMenuProps) {
  if (commands.length === 0) return null;

  return (
    <div
      id={id}
      role="listbox"
      aria-label="Kommandoforslag"
      data-chat-command-menu=""
      className={cn(
        'absolute bottom-full left-0 right-0 z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg',
        className,
      )}
    >
      <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Command className="size-3" aria-hidden />
        Kommandoer
      </p>
      {commands.map((command, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={command.id}
            type="button"
            id={`${id}-${command.id}`}
            role="option"
            aria-selected={active}
            data-chat-command={command.name}
            onMouseEnter={() => onActiveIndexChange(index)}
            onClick={() => onSelect(command)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
              active ? 'bg-muted' : 'hover:bg-muted/60',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                <span className="text-muted-foreground">/</span>
                {command.name}
                <span className="ml-2 font-normal text-muted-foreground">{command.label}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{command.hint}</span>
            </span>
            {active ? (
              <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
