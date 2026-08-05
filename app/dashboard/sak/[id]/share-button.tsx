'use client';

import { Share2, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

type ShareButtonProps = {
  id: string;
  title: string;
  className?: string;
};

export default function ShareButton({ id, title, className = '' }: ShareButtonProps) {
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
      className={`inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 ${className}`.trim()}
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
