'use client';

import { Share2, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ShareButton({ id, title }: { id: string, title: string }) {
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
      onClick={handleShare}
      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm"
    >
      {copied ? <Check className="w-4 h-4 mr-2 text-emerald-600" /> : <Share2 className="w-4 h-4 mr-2" />}
      {copied ? 'Lenke kopiert!' : 'Del sak'}
    </button>
  );
}
