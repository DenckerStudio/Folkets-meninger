'use client';

import { useEffect, useRef, useState } from 'react';
import { Quote, MessagesSquare } from 'lucide-react';
import { useSakShareOptional } from '@/components/sak/sak-share-context';
import { redditOAuthStartPath } from '@/lib/reddit';

const MIN_QUOTE_LENGTH = 12;

function selectedTextInToolbar(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-sak-selection-toolbar]'));
}

export function SakSelectionToolbar() {
  const share = useSakShareOptional();
  const [text, setText] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const hideTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!share) return;

    const update = () => {
      const selection = window.getSelection();
      const raw = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
      if (!selection || selection.rangeCount === 0 || raw.length < MIN_QUOTE_LENGTH) {
        setText('');
        setCoords(null);
        return;
      }

      const anchor = selection.anchorNode?.parentElement;
      if (anchor?.closest('input, textarea, [contenteditable="true"]')) {
        setText('');
        setCoords(null);
        return;
      }

      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setText('');
        setCoords(null);
        return;
      }

      setText(raw);
      setCoords({
        top: Math.max(12, rect.top - 44),
        left: Math.min(
          window.innerWidth - 180,
          Math.max(12, rect.left + rect.width / 2 - 80),
        ),
      });
    };

    const onMouseUp = (event: MouseEvent) => {
      if (selectedTextInToolbar(event.target)) return;
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(update, 10);
    };

    const onKeyUp = () => {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(update, 10);
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
      window.clearTimeout(hideTimer.current);
    };
  }, [share]);

  if (!share || !coords || !text) return null;

  const redditHref = redditOAuthStartPath({
    kind: 'quote',
    title: share.title,
    url: `/dashboard/sak/${share.sakId}`,
    quote: text,
    sourceLabel: share.title,
    next: `/dashboard/sak/${share.sakId}`,
  });

  return (
    <div
      data-sak-selection-toolbar
      className="fixed z-40 flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg"
      style={{ top: coords.top, left: coords.left }}
    >
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => share.openQuoteShare({ quote: text, sourceLabel: share.title })}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
      >
        <Quote className="h-3.5 w-3.5" />
        Del sitat
      </button>
      {redditHref ? (
        <a
          href={redditHref}
          onMouseDown={(event) => event.preventDefault()}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
        >
          <MessagesSquare className="h-3.5 w-3.5" />
          Reddit
        </a>
      ) : null}
    </div>
  );
}
