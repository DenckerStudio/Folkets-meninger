'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ForumPromptCarousel from '@/components/forum/forum-prompt-carousel';
import type { ForumPrompt } from '@/lib/forum/prompt-queries';

type PromptsFeedProps = {
  initialItems: ForumPrompt[];
  initialCursor: string | null;
};

export function ForumPromptsFeed({ initialItems, initialCursor }: PromptsFeedProps) {
  const [items, setItems] = useState<ForumPrompt[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canLoadMore = !!cursor && !loading;

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/forum/prompts?limit=16&cursor=${encodeURIComponent(cursor)}`, {
        cache: 'no-store',
      });
      const json = (await res.json()) as { items?: ForumPrompt[]; nextCursor?: string | null; error?: string };
      if (!res.ok) {
        setError(json.error || 'Kunne ikke laste flere');
        return;
      }
      const nextItems = Array.isArray(json.items) ? json.items : [];
      setItems((prev) => [...prev, ...nextItems]);
      setCursor(json.nextCursor ?? null);
    } catch {
      setError('Kunne ikke laste flere');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const onScroll = () => {
      if (!canLoadMore) return;
      const remaining = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining < 800) void loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [canLoadMore, loadMore]);

  const groups = useMemo(() => {
    // Reuse existing reel cards UI; render as multiple rows.
    // ForumPromptCarousel already formats a single horizontal strip.
    const chunkSize = 8;
    const rows: ForumPrompt[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) rows.push(items.slice(i, i + chunkSize));
    return rows;
  }, [items]);

  return (
    <div className="space-y-6">
      {groups.map((row, idx) => (
        <ForumPromptCarousel
          key={idx}
          prompts={row}
          showHeader={idx === 0}
          showSeeAll={false}
          title="Spesielle saker"
        />
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {cursor ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loading}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 disabled:opacity-60"
        >
          {loading ? 'Laster…' : 'Last flere'}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground text-center">Ingen flere spesielle saker akkurat nå.</p>
      )}
    </div>
  );
}

