'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import type { ResearchTopicRow } from '@/lib/admin/research/topic-types';
import { researchTopicBlogCanCreate, researchTopicBlogBlockingMessage } from '@/lib/admin/research/topic-blog-draft';
import { cn } from '@/lib/utils';

type DraftState = {
  adminUrl: string;
  cmsStatus: string;
};

export function ResearchTopicBlogDraftPanel({ topic }: { topic: ResearchTopicRow }) {
  const [existingDraft, setExistingDraft] = useState<DraftState | null>(null);
  const [cmsLookupFailed, setCmsLookupFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState(false);

  const canCreate = researchTopicBlogCanCreate(topic);
  const blockingMessage = researchTopicBlogBlockingMessage(topic);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/research/topics/${encodeURIComponent(topic.id)}/blog-draft`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        existing_draft?: { admin_url: string; cms_status: string } | null;
        cms_lookup_failed?: boolean;
      };
      setCmsLookupFailed(body.cms_lookup_failed === true);
      if (body.existing_draft?.admin_url) {
        setExistingDraft({
          adminUrl: body.existing_draft.admin_url,
          cmsStatus: body.existing_draft.cms_status,
        });
      } else {
        setExistingDraft(null);
      }
    } catch {
      /* ignore */
    }
  }, [topic.id]);

  useEffect(() => {
    if (canCreate) void refreshState();
  }, [canCreate, refreshState]);

  const createDraft = useCallback(
    async (forceNew: boolean) => {
      setError('');
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
          created?: boolean;
        };
        if (!res.ok) {
          setError(
            typeof body.message === 'string' && body.message.trim()
              ? body.message
              : 'Kunne ikke opprette bloggutkast',
          );
          return;
        }
        if (body.needs_confirm_for_new && body.admin_url) {
          setExistingDraft({
            adminUrl: body.admin_url,
            cmsStatus: body.cms_status ?? 'draft',
          });
          setConfirmNewOpen(true);
          return;
        }
        if (body.admin_url) {
          setExistingDraft({
            adminUrl: body.admin_url,
            cmsStatus: body.cms_status ?? 'draft',
          });
          setCreatedNotice(true);
          setConfirmNewOpen(false);
        }
      } catch {
        setError('Kunne ikke opprette bloggutkast');
      } finally {
        setPending(false);
      }
    },
    [topic.id],
  );

  if (topic.status !== 'done') {
    return null;
  }

  if (!canCreate) {
    return <ResearchTopicBlogDraftBlockedNotice message={blockingMessage} />;
  }

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
        <p className="text-sm text-muted-foreground" role="status">
          Kunne ikke sjekke om utkast finnes fra før (CMS utilgjengelig).
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {existingDraft ? (
          <Link
            href={existingDraft.adminUrl}
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

        {!existingDraft ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void createDraft(false)}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'min-h-11 gap-1.5')}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Lag blogg-utkast
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmNewOpen(true)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-11 gap-1.5')}
          >
            Lag nytt utkast
          </button>
        )}
      </div>

      {existingDraft ? (
        <p className="text-xs text-muted-foreground">
          Status i CMS: {existingDraft.cmsStatus === 'published' ? 'publisert' : 'utkast'}
        </p>
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

function ResearchTopicBlogDraftBlockedNotice({ message }: { message: string }) {
  return (
    <section className="rounded-xl border border-border bg-muted/40 p-4" role="status">
      <h2 className="text-base font-semibold text-foreground">Bloggutkast</h2>
      <p className="mt-2 text-sm text-foreground">{message}</p>
    </section>
  );
}
