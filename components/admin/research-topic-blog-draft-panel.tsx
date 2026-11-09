'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import type { ResearchTopicRow } from '@/lib/admin/research/topic-types';
import { researchTopicBlogCanCreate } from '@/lib/admin/research/topic-blog-draft-client';
import { cn } from '@/lib/utils';

type DraftState = {
  adminUrl: string;
  cmsStatus: string;
  slug: string;
};

export function ResearchTopicBlogDraftPanel({ topic }: { topic: ResearchTopicRow }) {
  const [primaryDraft, setPrimaryDraft] = useState<DraftState | null>(null);
  const [otherDrafts, setOtherDrafts] = useState<DraftState[]>([]);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [cmsLookupFailed, setCmsLookupFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);

  const canCreate = researchTopicBlogCanCreate(topic);

  const applyListBody = useCallback(
    (body: {
      primary_draft?: {
        admin_url: string;
        cms_status: string;
        slug: string;
      } | null;
      other_drafts?: { admin_url: string; cms_status: string; slug: string }[];
      cms_lookup_failed?: boolean;
    }) => {
      setCmsLookupFailed(body.cms_lookup_failed === true);
      if (body.primary_draft?.admin_url) {
        setPrimaryDraft({
          adminUrl: body.primary_draft.admin_url,
          cmsStatus: body.primary_draft.cms_status,
          slug: body.primary_draft.slug,
        });
      } else {
        setPrimaryDraft(null);
      }
      setOtherDrafts(
        (body.other_drafts ?? [])
          .filter((row) => Boolean(row.admin_url))
          .map((row) => ({
            adminUrl: row.admin_url,
            cmsStatus: row.cms_status,
            slug: row.slug,
          })),
      );
    },
    [],
  );

  const refreshState = useCallback(async () => {
    setLookupLoading(true);
    try {
      const res = await fetch(
        `/api/admin/research/topics/${encodeURIComponent(topic.id)}/blog-draft`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setCmsLookupFailed(true);
        return;
      }
      const body = (await res.json()) as Parameters<typeof applyListBody>[0];
      applyListBody(body);
    } catch {
      setCmsLookupFailed(true);
    } finally {
      setLookupLoading(false);
    }
  }, [applyListBody, topic.id]);

  useEffect(() => {
    if (canCreate) void refreshState();
  }, [canCreate, refreshState]);

  const createDraft = useCallback(
    async (forceNew: boolean) => {
      setError('');
      setCreatedNotice(false);
      setPending(true);
      try {
        const payload: Record<string, unknown> = {};
        if (forceNew) {
          payload.force_new = true;
          payload.variant_id = crypto.randomUUID();
        }
        const res = await fetch(
          `/api/admin/research/topics/${encodeURIComponent(topic.id)}/blog-draft`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          admin_url?: string;
          cms_status?: string;
          needs_confirm_for_new?: boolean;
        };
        if (!res.ok) {
          setError(
            typeof body.message === 'string' && body.message.trim()
              ? body.message
              : 'Kunne ikke opprette bloggutkast',
          );
          setCreatedNotice(false);
          return;
        }
        if (body.needs_confirm_for_new && body.admin_url) {
          setConfirmNewOpen(true);
          await refreshState();
          return;
        }
        if (body.admin_url) {
          setCreatedNotice(true);
          setConfirmNewOpen(false);
          await refreshState();
        }
      } catch {
        setError('Kunne ikke opprette bloggutkast');
        setCreatedNotice(false);
      } finally {
        setPending(false);
      }
    },
    [refreshState, topic.id],
  );

  if (topic.status !== 'done' || !canCreate) {
    return null;
  }

  const hasDrafts = Boolean(primaryDraft);

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="research-topic-blog-draft-heading"
    >
      <div className="space-y-1">
        <h2 id="research-topic-blog-draft-heading" className="text-base font-semibold text-foreground">
          Bloggutkast
        </h2>
        <p className="text-sm text-muted-foreground">
          Oppretter et utkast i bloggen (Payload). Ingenting publiseres automatisk — redaktør
          godkjenner først.
        </p>
      </div>

      {createdNotice ? (
        <p className="text-sm text-foreground" role="status">
          Utkastet er opprettet. Åpne det i blogg-admin for videre redigering.
        </p>
      ) : null}

      {cmsLookupFailed ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          role="alert"
        >
          <p className="min-w-0 flex-1">
            Kunne ikke sjekke om utkast finnes fra før (CMS utilgjengelig).
          </p>
          <button
            type="button"
            disabled={lookupLoading}
            onClick={() => void refreshState()}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'min-h-9 shrink-0 border-amber-600/30 bg-background',
            )}
          >
            Prøv igjen
          </button>
        </div>
      ) : null}

      {lookupLoading ? (
        <div className="flex flex-wrap items-center gap-2" aria-busy="true" aria-label="Laster utkast-status">
          <div className="h-11 min-w-[9.5rem] animate-pulse rounded-lg bg-muted" />
          <div className="h-11 min-w-[9.5rem] animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {primaryDraft ? (
            <Link
              href={primaryDraft.adminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'default', size: 'sm' }),
                'min-h-11 gap-1.5',
              )}
            >
              Åpne utkast
              <ExternalLink className="size-4 shrink-0" aria-hidden />
            </Link>
          ) : null}

          {!hasDrafts ? (
            <button
              type="button"
              disabled={pending || cmsLookupFailed}
              onClick={() => void createDraft(false)}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'min-h-11 gap-1.5')}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Lag blogg-utkast
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || cmsLookupFailed}
              onClick={() => setConfirmNewOpen(true)}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-11 gap-1.5')}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Lag nytt utkast
            </button>
          )}
        </div>
      )}

      {!lookupLoading && primaryDraft ? (
        <p className="text-xs text-muted-foreground">
          Siste utkast i CMS:{' '}
          {primaryDraft.cmsStatus === 'published' ? 'publisert' : 'utkast'} ({primaryDraft.slug})
        </p>
      ) : null}

      {!lookupLoading && otherDrafts.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Tidligere utkast fra samme brief</p>
          <ul className="space-y-1">
            {otherDrafts.map((draft) => (
              <li key={draft.adminUrl}>
                <Link
                  href={draft.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1 text-xs text-brand hover:underline"
                >
                  {draft.slug}
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={confirmNewOpen}
        onClose={() => {
          if (!pending) setConfirmNewOpen(false);
        }}
        title="Nytt bloggutkast?"
        description="Et utkast finnes allerede for denne briefen. Vil du lage et ekstra utkast? Det eksisterende utkastet blir stående uendret."
        size="md"
        className="sm:max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmNewOpen(false)}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => void createDraft(true)}
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {pending ? 'Oppretter…' : 'Lag nytt utkast'}
            </button>
          </div>
        }
      >
        <span className="sr-only">Bekreft nytt bloggutkast fra tema-brief</span>
      </Dialog>
    </section>
  );
}
