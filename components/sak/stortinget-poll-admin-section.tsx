'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Loader2 } from 'lucide-react';
import { AdminToast, useAdminToast } from '@/components/admin/app-future/admin-toast';
import { Dialog } from '@/components/ui/dialog';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import { publishStortingetPollAction } from '@/lib/polls/stortinget-poll-admin-action';
import {
  STORTINGET_POLL_NEUTRAL_SUMMARY_MAX,
  STORTINGET_POLL_TITLE_MAX,
  utcIsoToOsloLocalInput,
} from '@/lib/polls/stortinget-poll-admin';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type ExistingPoll = {
  id: string;
  title: string;
  neutralSummary: string;
  closesAt: string | null;
};

type StortingetPollAdminSectionProps = {
  sakId: string;
  sakTitle: string;
  defaultNeutralSummary: string;
  stortingetPageUrl: string;
  existingPoll: ExistingPoll | null;
  /** Kun for docs/screenshots — åpner dialog ved mount. */
  captureDialogOpen?: boolean;
};

export function StortingetPollAdminSection({
  sakId,
  sakTitle,
  defaultNeutralSummary,
  stortingetPageUrl,
  existingPoll,
  captureDialogOpen = false,
}: StortingetPollAdminSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(captureDialogOpen);
  const [title, setTitle] = useState(sakTitle);
  const [neutralSummary, setNeutralSummary] = useState(defaultNeutralSummary);
  const [closesAtOslo, setClosesAtOslo] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [publishedPollId, setPublishedPollId] = useState<string | null>(null);
  const router = useRouter();
  const { message, variant, toast } = useAdminToast();

  const ballotPreview = POLL_BALLOT_BUTTON_ORDER.map((choice) => pollChoiceLabel(choice)).join(' · ');

  function openDialog() {
    setTitle(existingPoll?.title ?? sakTitle);
    setNeutralSummary(existingPoll?.neutralSummary ?? defaultNeutralSummary);
    setClosesAtOslo(existingPoll?.closesAt ? utcIsoToOsloLocalInput(existingPoll.closesAt) : '');
    setFieldError(null);
    setDialogOpen(true);
  }

  function handlePublish() {
    setFieldError(null);
    startTransition(async () => {
      const result = await publishStortingetPollAction({
        issueId: sakId,
        title,
        neutralSummary,
        closesAtOslo: closesAtOslo.trim() || null,
      });
      if (!result.ok) {
        setFieldError(result.error);
        toast(result.error, 'error');
        return;
      }
      setPublishedPollId(result.pollId);
      setDialogOpen(false);
      toast('Avstemningen er publisert.');
      router.refresh();
    });
  }

  return (
    <>
      <section
        className="rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-4 sm:p-5"
        aria-label="Admin: avstemning"
      >
        <h2 className="text-sm font-semibold text-foreground">Avstemning (admin)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Publiser en offentlig Ja / Nei / Blank-avstemning knyttet til denne saken.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {publishedPollId || existingPoll ? (
            <>
              <Link
                href={routes.poll(publishedPollId ?? existingPoll!.id)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-brand hover:bg-muted/60',
                  VURDER_FOCUS_RING,
                )}
              >
                Se avstemningen
              </Link>
              <button
                type="button"
                onClick={openDialog}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90',
                  VURDER_FOCUS_RING,
                )}
              >
                Oppdater avstemning
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openDialog}
              className={cn(
                'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90',
                VURDER_FOCUS_RING,
              )}
            >
              Opprett avstemning
            </button>
          )}
        </div>
        {publishedPollId ? (
          <p className="mt-3 text-sm text-foreground">
            <Link href={routes.poll(publishedPollId)} className="font-medium text-brand hover:underline">
              Gå til avstemningen
            </Link>
          </p>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!pending) setDialogOpen(false);
        }}
        title={existingPoll ? 'Oppdater avstemning' : 'Publiser avstemning'}
        description="Avstemningen blir synlig for alle med en gang du publiserer."
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
              className={cn(
                'inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted',
                VURDER_FOCUS_RING,
              )}
            >
              Avbryt
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handlePublish}
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60',
                VURDER_FOCUS_RING,
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Publiser avstemning
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Publisering gjør avstemningen offentlig med en gang. Alle innloggede kan stemme Ja, Nei eller
            Blank.
          </p>

          <div className="space-y-2">
            <label htmlFor="stortinget-poll-title" className="text-sm font-medium text-foreground">
              Tittel <span className="text-destructive">*</span>
            </label>
            <input
              id="stortinget-poll-title"
              type="text"
              required
              maxLength={STORTINGET_POLL_TITLE_MAX}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Maks {STORTINGET_POLL_TITLE_MAX} tegn ({title.length}/{STORTINGET_POLL_TITLE_MAX})
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="stortinget-poll-ingress" className="text-sm font-medium text-foreground">
              Nøytral ingress
            </label>
            <textarea
              id="stortinget-poll-ingress"
              rows={4}
              maxLength={STORTINGET_POLL_NEUTRAL_SUMMARY_MAX}
              value={neutralSummary}
              onChange={(event) => setNeutralSummary(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="stortinget-poll-closes" className="text-sm font-medium text-foreground">
              Sluttidspunkt (valgfritt)
            </label>
            <input
              id="stortinget-poll-closes"
              type="datetime-local"
              value={closesAtOslo}
              onChange={(event) => setClosesAtOslo(event.target.value)}
              className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">Tid i Europe/Oslo. Må ligge i fremtiden hvis du fyller inn.</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">Kilde</span>
            <a
              href={stortingetPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-brand hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              <span className="break-all">{stortingetPageUrl}</span>
            </a>
          </div>

          <p className="text-xs text-muted-foreground">Svaralternativer: {ballotPreview}</p>

          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
        </div>
      </Dialog>

      <AdminToast message={message} variant={variant} />
    </>
  );
}
