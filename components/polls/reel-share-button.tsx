'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { SHARE_POLLS_ENABLED, buildPollShareText } from '@/lib/share/flag';
import { routes } from '@/lib/routes';
import type { PollChoice } from '@/lib/polls/types';

type ReelShareButtonProps = {
  pollId: string;
  title: string;
  choice?: PollChoice | null;
};

/**
 * Shares a Reel with a poll deeplink. Native share sheet when available,
 * clipboard fallback otherwise. The rich `/del` OG preview is gated behind
 * `SHARE_POLLS_ENABLED` (B5).
 */
export function ReelShareButton({ pollId, title, choice = null }: ReelShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  const share = async () => {
    if (typeof window === 'undefined') return;
    const url = new URL(routes.utforskReels(pollId), window.location.origin).toString();
    const text = buildPollShareText(title, choice);

    if (SHARE_POLLS_ENABLED) {
      // TODO(B5): route through /del for a rich OG preview once PR #147 lands.
    }

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked — nothing to do.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/20"
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? 'Lenke kopiert' : 'Del'}
    </button>
  );
}
