'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, MessagesSquare, Plus } from 'lucide-react';
import type { MineInnleggItem } from '@/lib/forum/user-activity';
import { routes } from '@/lib/routes';

export function MineInnleggList({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<MineInnleggItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/user/forum-posts?page=${pageNum}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) return;

      const next = (json.items ?? []) as MineInnleggItem[];
      setItems((prev) => (append ? [...prev, ...next] : next));
      setHasMore(!!json.hasMore);
      setPage(pageNum);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(1, false);
  }, [load]);

  if (loading) {
    return <p className="text-sm text-gray-500 py-4">Laster innlegg…</p>;
  }

  if (items.length === 0) {
    return (
      <div className={`text-center py-8 ${embedded ? '' : 'rounded-xl border border-gray-200 bg-gray-50'}`}>
        <MessagesSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Du har ikke publisert i forumet ennå</p>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          Innlegg vises med ditt navn og er offentlige.
        </p>
        <Link
          href={routes.forumNew()}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          <Plus className="w-4 h-4" />
          Start en diskusjon
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <Link
              href={
                item.kind === 'thread'
                  ? routes.forumTopic(item.threadId)
                  : `${routes.forumTopic(item.threadId)}#reply-${item.id}`
              }
              className="block px-4 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    item.kind === 'thread'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.kind === 'thread' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <MessagesSquare className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-0.5">
                    <span className="font-medium text-gray-700">
                      {item.kind === 'thread' ? 'Tråd' : 'Svar'}
                    </span>
                    <span>·</span>
                    <span>{item.createdAtLabel}</span>
                    {item.likeCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{item.likeCount} liker</span>
                      </>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 line-clamp-1">
                    {item.kind === 'thread' ? item.title : item.threadTitle}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{item.excerpt}</p>
                  {item.kind === 'thread' && item.replyCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{item.replyCount} svar</p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => load(page + 1, true)}
          className="w-full py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
        >
          {loadingMore ? 'Laster…' : 'Vis flere'}
        </button>
      )}
    </div>
  );
}
