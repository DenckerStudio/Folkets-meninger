'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { BlogDraftEditPanel } from '@/components/admin/blog-draft-edit-panel';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { DraftExpiryBadge } from '@/components/admin/draft-expiry-badge';
import {
  DraftReviewQueueToggle,
  type DraftReviewQueue,
} from '@/components/admin/draft-review-queue-toggle';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { BlogDraftEditSaved } from '@/lib/admin/blog-draft-edit';
import { BLOG_DRAFT_EDIT_PANEL_DISABLED_NOTE } from '@/lib/admin/blog-draft-edit-fields';
import {
  BLOG_DRAFT_SAVE_SUCCESS_MESSAGE,
  clearDraftSaveSuccess,
  isDraftSaveSuccessVisible,
  markDraftSaveSuccessVisible,
  nextEditEnabledState,
  shouldShowBlogDraftEditDisabledNote,
} from '@/lib/admin/blog-draft-edit-panel-state';
import { formatBlogReviewState } from '@/lib/admin/blog-review-labels';
import {
  blogDraftReviewItemForReopen,
  mergeBlogDraftReviewItemAfterEdit,
  type BlogDraftReviewItem,
} from '@/lib/admin/blog-review';
import { DRAFT_RESTORE_SUCCESS_MESSAGE } from '@/lib/admin/draft-expiry';

type DraftsResponse = {
  drafts?: BlogDraftReviewItem[];
  cmsConfigured?: boolean;
  editEnabled?: boolean;
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
  const [editEnabled, setEditEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [saveSuccessUntilByDraftId, setSaveSuccessUntilByDraftId] = useState<Record<string, number>>(
    {},
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);
  const [, setSaveSuccessTick] = useState(0);

  const loadDrafts = () => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch(
          `/api/admin/blog-drafts?queue=${queue === 'expired' ? 'expired' : 'pending'}`,
        );
        const json = (await res.json()) as DraftsResponse & { error?: string };
        if (!res.ok) {
          setDrafts([]);
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke laste utkast.');
          return;
        }
        setDrafts(json.drafts ?? []);
        setCmsConfigured(json.cmsConfigured !== false);
        setEditEnabled((prev) => nextEditEnabledState(prev, json.editEnabled));
      } catch {
        setDrafts([]);
        setError('Kunne ikke laste utkast.');
      } finally {
        setInitialLoad(false);
      }
    });
  };

  useEffect(() => {
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when queue changes
  }, [queue]);

  useEffect(() => {
    const hasVisible = Object.values(saveSuccessUntilByDraftId).some((until) => until > Date.now());
    if (!hasVisible) return;
    const timer = window.setInterval(() => {
      setSaveSuccessTick((tick) => tick + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, [saveSuccessUntilByDraftId]);

  const handleDraftSaved = (saved: BlogDraftEditSaved) => {
    setDrafts((current) => mergeBlogDraftReviewItemAfterEdit(current, saved));
    setSaveSuccessUntilByDraftId((current) => markDraftSaveSuccessVisible(current, saved.id));
    loadDrafts();
  };

  const clearSaveSuccessForDraft = (draftId: string) => {
    setSaveSuccessUntilByDraftId((current) => clearDraftSaveSuccess(current, draftId));
  };

  const restoreDraft = (id: string) => {
    startTransition(async () => {
      setError('');
      setRestoreSuccess('');
      const res = await fetch('/api/admin/blog-drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'restore' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Gjenoppretting feilet.');
        return;
      }
      setRestoreSuccess(DRAFT_RESTORE_SUCCESS_MESSAGE);
      setDrafts((current) => current.filter((row) => row.id !== id));
    });
  };

  const openEdit = (draft: BlogDraftReviewItem) => {
    setActiveId(null);
    setEditingId(draft.id);
  };

  const activeDraft = activeId ? blogDraftReviewItemForReopen(drafts, activeId) : null;

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
      {shouldShowBlogDraftEditDisabledNote({
        initialLoad,
        queue,
        cmsConfigured,
        editEnabled,
      }) ? (
        <p className="text-sm text-muted-foreground" role="status">
          {BLOG_DRAFT_EDIT_PANEL_DISABLED_NOTE}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {restoreSuccess ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {restoreSuccess}
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
              <div className="min-w-0 flex-1">
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
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                {queue === 'pending' ? (
                  <DraftExpiryBadge
                    clock={{
                      createdAt: draft.createdAt ?? draft.updatedAt,
                      restoredAt: draft.restoredAt,
                    }}
                  />
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {queue === 'pending' && editEnabled ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openEdit(draft)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Rediger her
                    </button>
                  ) : null}
                  {queue === 'pending' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(null);
                        setActiveId(draft.id);
                      }}
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
                  {draft.payloadAdminUrl ? (
                    <a
                      href={draft.payloadAdminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Åpne i Payload
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            {isDraftSaveSuccessVisible(saveSuccessUntilByDraftId, draft.id) ? (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
                {BLOG_DRAFT_SAVE_SUCCESS_MESSAGE}
              </p>
            ) : null}
            {editingId === draft.id ? (
              <BlogDraftEditPanel
                key={draft.id}
                draft={{
                  id: draft.id,
                  title: draft.title,
                  excerpt: draft.excerpt,
                  bodyMarkdown: draft.bodyMarkdown,
                  updatedAt: draft.updatedAt,
                }}
                onUserEdit={() => clearSaveSuccessForDraft(draft.id)}
                onCancel={() => {
                  clearSaveSuccessForDraft(draft.id);
                  setEditingId(null);
                }}
                onSaved={handleDraftSaved}
              />
            ) : null}
            {activeDraft?.id === draft.id ? (
              <ContentFeedbackPanel
                key={draft.id}
                className="mt-4"
                contentType="blog_post"
                contentId={draft.id}
                contentSubjectTitle={draft.title}
                title="Vurder blogginnlegg"
                description="Hva fungerte med utkastet, og hva bør justeres før publisering?"
                onSkip={() => setActiveId(null)}
                onSaved={() => {
                  loadDrafts();
                  setActiveId(null);
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
