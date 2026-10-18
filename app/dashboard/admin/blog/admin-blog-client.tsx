'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { BlogMarkdown } from '@/components/blog/blog-markdown';
import { EmptyState } from '@/components/dashboard/empty-state';
import { formatWhen } from '@/components/appens-fremtid/format';
import type { BlogPostRow } from '@/lib/blog/types';
import { BLOG_AUTHOR_LABEL } from '@/lib/blog/types';

function BlogDraftEditor({
  post,
  pending,
  onSave,
  onPublish,
  onReject,
}: {
  post: BlogPostRow;
  pending: boolean;
  onSave: (patch: { title: string; excerpt: string; body_md: string }) => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [bodyMd, setBodyMd] = useState(post.body_md);

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onPublish}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
        >
          Publiser
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReject}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          Avvis
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onSave({ title, excerpt, body_md: bodyMd })}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
        >
          Lagre endringer
        </button>
      </div>

      <div className="grid gap-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Tittel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Ingress</span>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Brødtekst (markdown)</span>
          <textarea
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
      </div>

      <div className="border-t border-border pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Forhåndsvisning</p>
        <div className="mt-4 rounded-xl border border-border bg-background p-6">
          <p className="text-xs text-muted-foreground">{BLOG_AUTHOR_LABEL}</p>
          <h3 className="mt-2 text-2xl font-bold text-foreground">{title || 'Uten tittel'}</h3>
          {excerpt ? <p className="mt-3 text-muted-foreground">{excerpt}</p> : null}
          <div className="mt-6">
            <BlogMarkdown markdown={bodyMd} className="prose-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlogClient() {
  const searchParams = useSearchParams();
  const queryPostId = searchParams.get('post');
  const [posts, setPosts] = useState<BlogPostRow[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/blog');
      const data = (await res.json().catch(() => ({}))) as {
        posts?: BlogPostRow[];
        tableReady?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke laste bloggutkast.');
        return;
      }
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTableReady(data.tableReady !== false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => {
    const id = activeId ?? queryPostId ?? posts[0]?.id ?? null;
    if (!id) return null;
    return posts.find((post) => post.id === id) ?? null;
  }, [activeId, queryPostId, posts]);

  const patch = (payload: Record<string, unknown>) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/blog', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke oppdatere.');
        return;
      }
      load();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileText className="h-5 w-5 text-brand" aria-hidden />
          Blogg
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Godkjenn utkast fra n8n før de blir synlige på /blogg. Ingenting publiseres uten at du trykker
          Publiser.
        </p>
        <AdminBackLink />
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!tableReady ? (
        <EmptyState
          title="blog_posts er ikke migrert ennå"
          description="Kjør migrasjonen 20261018120000_blog_posts.sql på Postgres i Coolify. Siden /blogg viser tom tilstand inntil da."
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Ingen utkast i køen"
          description="n8n kan opprette utkast via POST /api/ops/blog/drafts. De dukker opp her til en admin publiserer."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <aside className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Utkast</p>
            <ul className="space-y-2">
              {posts.map((post) => {
                const active = post.id === selected?.id;
                return (
                  <li key={post.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(post.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'border-brand/40 bg-brand/10 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="line-clamp-2 font-medium text-foreground">{post.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatWhen(post.created_at)} · {post.slug}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selected ? (
            <BlogDraftEditor
              key={selected.id}
              post={selected}
              pending={pending}
              onPublish={() => patch({ id: selected.id, action: 'publish' })}
              onReject={() => patch({ id: selected.id, action: 'reject' })}
              onSave={(fields) =>
                patch({
                  id: selected.id,
                  action: 'edit',
                  ...fields,
                })
              }
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
