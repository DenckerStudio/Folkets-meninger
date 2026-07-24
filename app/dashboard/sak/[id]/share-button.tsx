'use client';

import { Share2, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

type ShareButtonProps = {
  id: string;
  title: string;
  className?: string;
  compact?: boolean;
};

export default function ShareButton({ id, title, className = '', compact = false }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window.location.origin}/dashboard/sak/${id}`);
  }, [id]);

  const handleShare = async () => {
    const shareData = {
      title: `Folkets Stemme: ${title}`,
      text: `Se denne saken på Folkets Stemme: ${title}`,
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
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-400 ${
        compact ? 'py-2 text-xs sm:text-sm' : 'py-2.5'
      } ${className}`.trim()}
    >
      {copied ? (
        <Check className="mr-2 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Share2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
      )}
      {copied ? 'Lenke kopiert!' : 'Del sak'}
    </button>
  );
}
