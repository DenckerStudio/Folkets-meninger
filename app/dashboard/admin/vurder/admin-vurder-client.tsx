'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { EmptyState } from '@/components/dashboard/empty-state';
import { formatBlogReviewState } from '@/lib/admin/blog-review-labels';
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

function VurderDraftListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laster bloggutkast">
      {[0, 1, 2].map((key) => (
        <div key={key} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="h-5 w-3/4 max-w-md animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted/30" />
        </div>
      ))}
    </div>
  );
}

export default function AdminVurderClient() {
  const tab = 'blogg' as const;
  const bloggTabId = useId();
  const bloggPanelId = useId();
  const [drafts, setDrafts] = useState<BlogDraftReviewItem[]>([]);
  const [cmsConfigured, setCmsConfigured] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActiveReview | null>(null);
  const [pending, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  const loadDrafts = () => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch('/api/admin/blog-drafts');
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
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardCheck className="h-6 w-6 text-brand" aria-hidden />
          Vurder
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gi strukturert tilbakemelding på innhold som skal forbedres over tid.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border pb-3" role="tablist" aria-label="Vurderingsfaner">
        <button
          type="button"
          id={bloggTabId}
          role="tab"
          aria-selected={true}
          aria-controls={bloggPanelId}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand/10 px-4 py-2.5 text-sm font-medium text-brand"
        >
          Blogginnlegg
        </button>
      </div>

      <section
        id={bloggPanelId}
        role="tabpanel"
        aria-labelledby={bloggTabId}
        className="space-y-4"
      >
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
        {initialLoad && pending ? <VurderDraftListSkeleton /> : null}
        {!initialLoad && !error && cmsConfigured && drafts.length === 0 ? (
          <EmptyState
            title="Ingen utkast til vurdering"
            description="Når nye bloggutkast er klare til vurdering, vises de her."
            className="py-8"
          />
        ) : null}
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{draft.title}</p>
                  {draft.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{draft.excerpt}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBlogReviewState(draft.reviewState) ?? 'Utkast'}
                    {draft.updatedAt ? ` · Oppdatert ${new Date(draft.updatedAt).toLocaleString('nb-NO')}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                  <button
                    type="button"
                    onClick={() =>
                      setActive({
                        id: draft.id,
                        title: draft.title,
                        excerpt: draft.excerpt,
                        payloadAdminUrl: draft.payloadAdminUrl,
                      })
                    }
                    className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90"
                  >
                    Vurder
                  </button>
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
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <AdminBackLink />
        <Link href="/blogg" className="font-medium text-brand hover:underline">
          Offentlig blogg
        </Link>
      </div>
    </div>
  );
}
