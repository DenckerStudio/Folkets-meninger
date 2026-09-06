'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Flag, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import {
  CONTENT_REPORT_CATEGORIES,
  DISCUSSION_BODY_MAX,
  type ContentReportCategory,
  type DiscussionPostRecord,
} from '@/lib/discussion/types';

function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reportCategoryLabel(category: ContentReportCategory): string {
  switch (category) {
    case 'spam':
      return 'Spam';
    case 'hate':
      return 'Hatefulle ytringer';
    case 'harassment':
      return 'Trakassering';
    case 'misinformation':
      return 'Feilinformasjon';
    case 'other':
      return 'Annet';
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function DiscussionSection({ sakId }: { sakId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<DiscussionPostRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState('');

  const loadPosts = useCallback(
    async (cursor?: string | null, append = false) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      const query = params.toString();
      const res = await fetch(`/api/sak/${sakId}/discussion${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      const fetched = Array.isArray(json.posts) ? json.posts as DiscussionPostRecord[] : [];
      setPosts((current) => (append ? [...current, ...fetched] : fetched));
      setNextCursor(typeof json.nextCursor === 'string' ? json.nextCursor : null);
    },
    [sakId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPosts()
      .catch(() => {
        if (!cancelled) setError('Kunne ikke laste diskusjonen.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPosts]);

  const submitPost = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(`${routes.sak(sakId)}#diskusjon`)}`);
      return;
    }
    const text = body.trim();
    if (!text || busy) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/sak/${sakId}/discussion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Kunne ikke publisere innlegget');
        return;
      }
      setBody('');
      await loadPosts();
    } catch {
      setError('Kunne ikke publisere innlegget');
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPosts(nextCursor, true);
    } catch {
      setError('Kunne ikke laste flere innlegg.');
    } finally {
      setLoadingMore(false);
    }
  };

  const reportPost = async (postId: string, category: ContentReportCategory) => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(`${routes.sak(sakId)}#diskusjon`)}`);
      return;
    }

    setReportingId(postId);
    setReportMessage('');
    try {
      const res = await fetch(`/api/sak/${sakId}/discussion/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, category }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportMessage(json.error || 'Kunne ikke sende rapport');
        return;
      }
      setReportMessage('Takk — rapporten er registrert.');
    } catch {
      setReportMessage('Kunne ikke sende rapport');
    } finally {
      setReportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <MessageSquare className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
        <div>
          <h2 className="text-lg font-bold text-foreground">Diskusjon</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Åpen debatt om saken. Innlegg publiseres med navn og er offentlig lesbare. Stemmer er
            anonyme og vises ikke her.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        {user ? (
          <>
            <p className="text-xs text-muted-foreground">
              Publiser med fornavn og etternavn fra profilen din. Hold debatten saklig og respektfull.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={DISCUSSION_BODY_MAX}
              className="w-full rounded-lg border border-border p-3 text-sm"
              placeholder="Del synspunkter, spørsmål eller erfaringer knyttet til saken …"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {body.trim().length}/{DISCUSSION_BODY_MAX}
              </span>
              <button
                type="button"
                onClick={submitPost}
                disabled={busy || !body.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? 'Publiserer …' : 'Publiser innlegg'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-2">
            <Link
              href={`${routes.login}?next=${encodeURIComponent(`${routes.sak(sakId)}#diskusjon`)}`}
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Logg inn
            </Link>{' '}
            for å delta i diskusjonen. Alle kan lese innleggene.
          </p>
        )}
      </div>

      {reportMessage ? (
        <p className="text-sm text-muted-foreground" role="status">{reportMessage}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Laster diskusjon …</p>
      ) : posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Ingen kommentarer ennå — vær den første.
        </p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground"
                    aria-hidden
                  >
                    {post.authorInitials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {post.authorName ?? 'Bruker'}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatPostDate(post.createdAt)}</p>
                  </div>
                </div>
                {user ? (
                  <details className="relative shrink-0">
                    <summary
                      className="flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Rapporter innlegg"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Rapporter
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-border bg-card p-2 shadow-lg">
                      {CONTENT_REPORT_CATEGORIES.map((category) => (
                        <button
                          key={category}
                          type="button"
                          disabled={reportingId === post.id}
                          onClick={() => reportPost(post.id, category)}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {reportCategoryLabel(category)}
                        </button>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.body}</p>
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loadingMore ? 'Laster …' : 'Vis eldre innlegg'}
        </button>
      ) : null}
    </div>
  );
}
