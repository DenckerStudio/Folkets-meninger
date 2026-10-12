'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

function messageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

/**
 * Per-message controls: copy the assistant text to the clipboard, or regenerate the
 * response. Regenerate is disabled while a reply is streaming or when the message has
 * no text to copy.
 */
export function ChatMessageActions({
  text,
  busy,
  onRegenerate,
}: {
  text: string;
  busy: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const hasText = text.length > 0;

  async function copy() {
    if (!hasText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-1 pt-0.5">
      <button
        type="button"
        data-chat-action="copy"
        onClick={() => void copy()}
        disabled={!hasText}
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors',
          hasText
            ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
            : 'cursor-not-allowed text-muted-foreground/50',
        )}
      >
        {copied ? (
          <Check className="size-3" aria-hidden />
        ) : (
          <Copy className="size-3" aria-hidden />
        )}
        {copied ? 'Kopiert' : 'Kopier'}
      </button>
      {onRegenerate ? (
        <button
          type="button"
          data-chat-action="regenerate"
          onClick={onRegenerate}
          disabled={busy}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors',
            busy
              ? 'cursor-not-allowed text-muted-foreground/50'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <RefreshCw className="size-3" aria-hidden />
          Svar igjen
        </button>
      ) : null}
    </div>
  );
}

export function textFromMessageParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return messageText(parts as Array<{ type: string; text?: string }>);
}
