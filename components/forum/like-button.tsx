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
      <div className="flex min-w-[2.25rem] flex-col items-center py-0.5">
        <button
          type="button"
          onClick={handleToggle}
          disabled={!user || isSubmitting}
          className={`rounded-lg p-1.5 transition-colors disabled:opacity-40 ${
            liked ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground hover:bg-muted hover:text-indigo-600 dark:text-indigo-400'
          }`}
          aria-pressed={liked}
          aria-label={liked ? 'Fjern like' : 'Lik'}
        >
          <ChevronUp className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
        </button>
        <span className={`text-xs font-semibold tabular-nums ${liked ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
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
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        liked
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-muted-foreground hover:bg-muted hover:text-indigo-600 dark:text-indigo-400'
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
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Share2 className="w-4 h-4" />
      {copied ? 'Kopiert!' : 'Del'}
    </button>
  );
}

export function CommentCountPill({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <MessageCircle className="h-4 w-4" />
      {count}
    </span>
  );
}
