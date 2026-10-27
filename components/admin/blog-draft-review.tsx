'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { DraftExpiryBadge } from '@/components/admin/draft-expiry-badge';
import {
  DraftReviewQueueToggle,
  type DraftReviewQueue,
} from '@/components/admin/draft-review-queue-toggle';
import { EmptyState } from '@/components/dashboard/empty-state';
import { formatBlogReviewState } from '@/lib/admin/blog-review-labels';
import {
  DRAFT_RESTORE_SUCCESS_MESSAGE,
} from '@/lib/admin/draft-expiry';
import type { BlogDraftReviewItem } from '@/lib/admin/blog-review';

type DraftsResponse = {
  drafts?: BlogDraftReviewItem[];
  cmsConfigured?: boolean;
};

type ActiveReview = {
  id: string;
  title: string;
  excerpt: string;
  payloadAdminUrl: string | null;
};

function DraftListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laster bloggutkast">
      {[0, 1, 2].map((key) => (
        <div key={key} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="h-5 w-3/4 max-w-md animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/30" />
        </div>
      ))}
    </div>
  );
}

export function BlogDraftReview() {
  const [queue, setQueue] = useState<DraftReviewQueue>('pending');
  const [drafts, setDrafts] = useState<BlogDraftReviewItem[]>([]);
  const [cmsConfigured, setCmsConfigured] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [active, setActive] = useState<ActiveReview | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  const loadDrafts = () => {
    startTransition(async () => {
      setError('');
      setSuccess('');
      try {
        const res = await fetch(
          `/api/admin/blog-drafts?queue=${queue === 'expired' ? 'expired' : 'pending'}`,
        );
        const json = (await res.json()) as DraftsResponse & { error?: string };
        if (!res.ok) {
          setDrafts([]);
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke laste utkast');
          return;
        }
        setDrafts(json.drafts ?? []);
        setCmsConfigured(json.cmsConfigured !== false);
      } catch {
        setDrafts([]);
        setError('Kunne ikke laste utkast');
      } finally {
        setInitialLoad(false);
      }
    });
  };

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when queue changes
  }, [queue]);

  const restoreDraft = (id: string) => {
    startTransition(async () => {
      setError('');
      setSuccess('');
      const res = await fetch('/api/admin/blog-drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'restore' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Gjenoppretting feilet');
        return;
      }
      setSuccess(DRAFT_RESTORE_SUCCESS_MESSAGE);
      setDrafts((current) => current.filter((row) => row.id !== id));
    });
  };

  return (
    <div className="space-y-4">
      <DraftReviewQueueToggle queue={queue} onQueueChange={setQueue} className="max-w-md" />
      <p className="text-sm text-muted-foreground">
        {queue === 'pending'
          ? 'Utkast som venter på vurdering før de kan publiseres i bloggen. Utkast utløper etter 72 timer.'
          : 'Utløpte bloggutkast kan gjenopprettes til vurderingskøen.'}
      </p>
      {!cmsConfigured ? (
        <EmptyState
          title="Blogg er ikke tilgjengelig"
          description="Bloggsystemet er ikke koblet til ennå."
          className="py-8"
        />
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      {initialLoad ? <DraftListSkeleton /> : null}
      {!initialLoad && !error && cmsConfigured && drafts.length === 0 ? (
        <EmptyState
          title={queue === 'expired' ? 'Ingen utløpte utkast' : 'Ingen utkast til vurdering'}
          description={
            queue === 'expired'
              ? 'Utløpte bloggutkast vises her.'
              : 'Når nye bloggutkast er klare til vurdering, vises de her.'
          }
          className="py-8"
        />
      ) : null}
      <ul className="space-y-3">
        {drafts.map((draft) => (
          <li key={draft.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tittel</p>
                <p className="mt-1 font-medium text-foreground">{draft.title}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Beskrivelse
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {draft.excerpt?.trim() || 'Ingen beskrivelse er lagret for dette utkastet.'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatBlogReviewState(draft.reviewState) ?? 'Utkast'}
                  {queue === 'expired' && draft.expiredAt
                    ? ` · Utløpt ${new Date(draft.expiredAt).toLocaleString('nb-NO')}`
                    : draft.updatedAt
                      ? ` · Oppdatert ${new Date(draft.updatedAt).toLocaleString('nb-NO')}`
                      : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {queue === 'pending' ? (
                  <DraftExpiryBadge
                    clock={{
                      createdAt: draft.createdAt ?? draft.updatedAt,
                      restoredAt: draft.restoredAt,
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {draft.payloadAdminUrl ? (
                    <a
                      href={draft.payloadAdminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
                    >
                      Rediger utkast
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  ) : null}
                  {queue === 'pending' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setActive({
                          id: draft.id,
                          title: draft.title,
                          excerpt: draft.excerpt,
                          payloadAdminUrl: draft.payloadAdminUrl,
                        })
                      }
                      className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Vurder
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => restoreDraft(draft.id)}
                      className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Gjenopprett
                    </button>
                  )}
                </div>
              </div>
            </div>
            {active?.id === draft.id ? (
              <ContentFeedbackPanel
                key={draft.id}
                className="mt-4"
                contentType="blog_post"
                contentId={draft.id}
                contentSubjectTitle={draft.title}
                title="Vurder blogginnlegg"
                description="Hva fungerte med utkastet, og hva bør justeres før publisering?"
                onSkip={() => setActive(null)}
                onSaved={() => {
                  loadDrafts();
                  setActive(null);
                }}
              />
            ) : null}
          </li>
        ))}
      </ul>
      <Link href="/blogg" className="inline-flex text-sm font-medium text-brand hover:underline">
        Offentlig blogg
      </Link>
    </div>
  );
}
