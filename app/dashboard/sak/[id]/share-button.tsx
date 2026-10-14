'use client';

import { Share2, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

type ShareButtonProps = {
  id: string;
  title: string;
  className?: string;
};

export default function ShareButton({ id, title, className = '' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/dashboard/sak/${id}`);
  }, [id]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: `Folkets Meninger: ${title}`,
      text: `Se denne saken på Folkets Meninger: ${title}`,
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // Fallback to clipboard if user cancels or share fails
        if ((err as Error).name !== 'AbortError') {
          copyToClipboard();
        }
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, 2500);
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-brand ${className}`.trim()}
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {copied ? 'Lenke kopiert' : 'Del sak'}
    </button>
  );
}
