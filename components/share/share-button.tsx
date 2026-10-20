'use client';

import { Check, Link2, Share2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function resolveShareUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (typeof window === 'undefined') return url;
  return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
}

type ShareButtonProps = {
  url: string;
  title: string;
  text?: string;
  className?: string;
  label?: string;
  copiedLabel?: string;
};

export function ShareButton({
  url,
  title,
  text,
  className,
  label = 'Del',
  copiedLabel = 'Lenke kopiert',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const resolvedUrl = resolveShareUrl(url);
    if (!resolvedUrl) return;
    void navigator.clipboard.writeText(resolvedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    const resolvedUrl = resolveShareUrl(url);
    const shareData = {
      title,
      text: text ?? title,
      url: resolvedUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#00205b]/15 bg-white px-3 text-sm font-medium text-[#001433]/75 hover:bg-[#00205b]/[0.04]"
      >
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
        {label}
      </button>
      <button
        type="button"
        onClick={copyToClipboard}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#00205b]/15 bg-white px-3 text-sm font-medium text-[#001433]/75 hover:bg-[#00205b]/[0.04]"
      >
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <Link2 className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {copied ? copiedLabel : 'Kopier lenke'}
      </button>
    </div>
  );
}
