'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, MessageCircle, Share2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { ForumTargetType } from '@/lib/forum/validation';

type LikeButtonProps = {
  targetType: ForumTargetType;
  targetId: string;
  initialCount: number;
  initialLiked?: boolean;
  variant?: 'default' | 'pill';
  stopPropagation?: boolean;
};

export default function LikeButton({
  targetType,
  targetId,
  initialCount,
  initialLiked = false,
  variant = 'default',
  stopPropagation = false,
}: LikeButtonProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    const prevLiked = liked;
    const prevCount = count;

    setLiked(!prevLiked);
    setCount(prevLiked ? prevCount - 1 : prevCount + 1);

    try {
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_like',
          target_type: targetType,
          target_id: targetId,
        }),
      });

      if (!res.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }

      const data = await res.json();
      setLiked(data.liked);
      router.refresh();
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'pill') {
    return (
      <div
        className={`flex flex-col items-center rounded-full border bg-gray-50 min-w-[40px] py-1 ${
          liked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
        }`}
      >
        <button
          type="button"
          onClick={handleToggle}
          disabled={!user || isSubmitting}
          className={`p-1 rounded-full transition-colors disabled:opacity-50 ${
            liked ? 'text-indigo-600' : 'text-gray-500 hover:text-indigo-600 hover:bg-white'
          }`}
          aria-pressed={liked}
          aria-label={liked ? 'Fjern like' : 'Lik'}
        >
          <ChevronUp className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
        </button>
        <span className={`text-xs font-bold tabular-nums ${liked ? 'text-indigo-700' : 'text-gray-700'}`}>
          {count}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!user || isSubmitting}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        liked
          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
      }`}
      aria-pressed={liked}
    >
      <ChevronUp className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
      {count}
    </button>
  );
}

export function ShareThreadButton({ threadId }: { threadId: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/dashboard/forum/${threadId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-900 transition-colors"
    >
      <Share2 className="w-4 h-4" />
      {copied ? 'Kopiert!' : 'Del'}
    </button>
  );
}

export function CommentCountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600">
      <MessageCircle className="w-4 h-4" />
      {count}
    </span>
  );
}
