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
  isPollClosesAtPast,
  validateStortingetPollAdminForm,
  utcIsoToNorwegianClosesAtFields,
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
  captureEditDialogOpen?: boolean;
  captureDialogStep?: 'form' | 'confirm';
  captureFieldError?: string | null;
  capturePending?: boolean;
};

const FIELD_CLASS = cn(
  'min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
  VURDER_FOCUS_RING,
);

const TEXTAREA_CLASS = cn(
  'min-h-[7rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
  VURDER_FOCUS_RING,
);

const BTN_SECONDARY = cn(
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted',
  VURDER_FOCUS_RING,
);

const BTN_PRIMARY = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-60',
  VURDER_FOCUS_RING,
);

function ballotSectionPhrase(): string {
  return `${POLL_BALLOT_BUTTON_ORDER.map((choice) => pollChoiceLabel(choice)).join(' / ')}-avstemning`;
}

function ballotWarningPhrase(): string {
  const labels = POLL_BALLOT_BUTTON_ORDER.map((choice) => pollChoiceLabel(choice));
  return `${labels[0]}, ${labels[1]} eller ${labels[2]}`;
}

export function StortingetPollAdminSection({
  sakId,
  sakTitle,
  defaultNeutralSummary,
  stortingetPageUrl,
  existingPoll,
  captureDialogOpen = false,
  captureEditDialogOpen = false,
  captureDialogStep = 'form',
  captureFieldError = null,
  capturePending = false,
}: StortingetPollAdminSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(captureDialogOpen || captureEditDialogOpen);
  const [dialogStep, setDialogStep] = useState<'form' | 'confirm'>(captureDialogStep);
  const [title, setTitle] = useState(sakTitle);
  const [neutralSummary, setNeutralSummary] = useState(defaultNeutralSummary);
  const [closesAtDate, setClosesAtDate] = useState('');
  const [closesAtTime, setClosesAtTime] = useState('');
  const [initialClosesAtWire, setInitialClosesAtWire] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(captureFieldError);
  const [pending, startTransition] = useTransition();
  const [publishedPollId, setPublishedPollId] = useState<string | null>(null);
  const router = useRouter();
  const { message, variant, toast } = useAdminToast();

  const hasPoll = Boolean(existingPoll || publishedPollId);
  const isEditMode = Boolean(existingPoll);
  const pollClosed =
    isEditMode && existingPoll?.closesAt ? isPollClosesAtPast(existingPoll.closesAt) : false;
  const showPending = pending || capturePending;
  const activePollId = existingPoll?.id ?? publishedPollId;

  function buildActionPayload() {
    return {
      issueId: sakId,
      title,
      neutralSummary,
      isUpdate: isEditMode,
      initialClosesAtWire,
      closesAtDate,
      closesAtTime,
    };
  }

  function loadClosesAtFields(closesAtIso: string | null) {
    if (!closesAtIso) {
      setClosesAtDate('');
      setClosesAtTime('');
      setInitialClosesAtWire(null);
      return;
    }
    const wire = utcIsoToOsloLocalInput(closesAtIso);
    setInitialClosesAtWire(wire || null);
    const fields = utcIsoToNorwegianClosesAtFields(closesAtIso);
    setClosesAtDate(fields.date);
    setClosesAtTime(fields.time);
  }

  function openDialog() {
    setTitle(existingPoll?.title ?? sakTitle);
    setNeutralSummary(existingPoll?.neutralSummary ?? defaultNeutralSummary);
    loadClosesAtFields(existingPoll?.closesAt ?? null);
    setFieldError(null);
    setDialogStep('form');
    setDialogOpen(true);
  }

  function closeDialog() {
    if (showPending) return;
    setDialogOpen(false);
    setDialogStep('form');
  }

  function validateForm(): boolean {
    const validated = validateStortingetPollAdminForm(buildActionPayload());
    if (!validated.ok) {
      setFieldError(validated.error);
      return false;
    }
    setFieldError(null);
    return true;
  }

  function handlePrimaryFormClick() {
    if (!validateForm()) return;
    if (isEditMode) {
      void executePublish();
      return;
    }
    setDialogStep('confirm');
  }

  function executePublish() {
    startTransition(async () => {
      const result = await publishStortingetPollAction(buildActionPayload());
      if (!result.ok) {
        setFieldError(result.error);
        setDialogStep('form');
        toast(result.error, 'error');
        return;
      }
      setPublishedPollId(result.pollId);
      setDialogOpen(false);
      setDialogStep('form');
      toast(isEditMode ? 'Endringene er lagret.' : 'Avstemningen er publisert.');
      router.refresh();
    });
  }

  const dialogTitle = isEditMode ? 'Rediger avstemning' : 'Publiser avstemning';
  const dialogDescription =
    dialogStep === 'confirm'
      ? 'Bekreft før avstemningen blir synlig.'
      : isEditMode
        ? 'Endringene vises for velgerne med en gang du lagrer.'
        : 'Avstemningen blir synlig for alle med en gang du publiserer.';

  return (
    <>
      <section
        className="rounded-2xl border border-dashed border-brand/30 bg-brand/5 p-4 sm:p-5"
        aria-label="Admin: avstemning"
      >
        <h2 className="text-sm font-semibold text-foreground">Avstemning (admin)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Publiser en offentlig {ballotSectionPhrase()} knyttet til denne saken.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {hasPoll && activePollId ? (
            <>
              <Link
                href={routes.poll(activePollId)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-brand hover:bg-muted/60',
                  VURDER_FOCUS_RING,
                )}
              >
                Se avstemningen
              </Link>
              <button type="button" onClick={openDialog} className={BTN_PRIMARY}>
                Rediger avstemning
              </button>
            </>
          ) : (
            <button type="button" onClick={openDialog} className={BTN_PRIMARY}>
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
        onClose={closeDialog}
        title={dialogStep === 'confirm' ? 'Publisere nå?' : dialogTitle}
        description={dialogDescription}
        footer={
          dialogStep === 'confirm' ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={showPending} onClick={() => setDialogStep('form')} className={BTN_SECONDARY}>
                Avbryt
              </button>
              <button type="button" disabled={showPending} onClick={() => executePublish()} className={BTN_PRIMARY}>
                {showPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Publiser
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={showPending} onClick={closeDialog} className={BTN_SECONDARY}>
                Avbryt
              </button>
              <button
                type="button"
                disabled={showPending}
                onClick={handlePrimaryFormClick}
                className={BTN_PRIMARY}
              >
                {showPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isEditMode ? 'Lagre endringer' : 'Publiser avstemning'}
              </button>
            </div>
          )
        }
      >
        {dialogStep === 'confirm' ? (
          <p className="text-sm leading-relaxed text-foreground">
            Avstemningen blir synlig for alle med en gang.
          </p>
        ) : (
          <div className="space-y-5">
            <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              {isEditMode
                ? `Endringene gjelder med en gang. Velgerne kan stemme ${ballotWarningPhrase()}.`
                : `Publisering gjør avstemningen offentlig med en gang. Alle innloggede kan stemme ${ballotWarningPhrase()}.`}
            </p>

            <div className="space-y-2">
              <label htmlFor="stortinget-poll-title" className="block text-sm font-medium text-foreground">
                Tittel <span className="text-destructive">*</span>
              </label>
              <input
                id="stortinget-poll-title"
                type="text"
                required
                maxLength={STORTINGET_POLL_TITLE_MAX}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={FIELD_CLASS}
              />
              <p className="text-xs text-muted-foreground">
                Maks {STORTINGET_POLL_TITLE_MAX} tegn ({title.length}/{STORTINGET_POLL_TITLE_MAX})
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="stortinget-poll-ingress" className="block text-sm font-medium text-foreground">
                Nøytral ingress
              </label>
              <textarea
                id="stortinget-poll-ingress"
                rows={4}
                maxLength={STORTINGET_POLL_NEUTRAL_SUMMARY_MAX}
                value={neutralSummary}
                onChange={(event) => setNeutralSummary(event.target.value)}
                className={TEXTAREA_CLASS}
              />
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-foreground">Sluttidspunkt (valgfritt)</span>
              {pollClosed && existingPoll?.closesAt ? (
                <p className="text-sm text-muted-foreground">
                  {(() => {
                    const closedAt = utcIsoToNorwegianClosesAtFields(existingPoll.closesAt);
                    return (
                      <>
                        Avstemningen er stengt (sluttidspunkt {closedAt.date} {closedAt.time}). Du kan lagre andre
                        endringer uten å endre sluttidspunktet.
                      </>
                    );
                  })()}
                </p>
              ) : null}
              <div className="flex max-w-md flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor="stortinget-poll-closes-date" className="block text-xs text-muted-foreground">
                    Dato (dd.mm.åååå)
                  </label>
                  <input
                    id="stortinget-poll-closes-date"
                    type="text"
                    inputMode="numeric"
                    placeholder="dd.mm.åååå"
                    autoComplete="off"
                    value={closesAtDate}
                    onChange={(event) => setClosesAtDate(event.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <label htmlFor="stortinget-poll-closes-time" className="block text-xs text-muted-foreground">
                    Klokkeslett (tt:mm)
                  </label>
                  <input
                    id="stortinget-poll-closes-time"
                    type="text"
                    inputMode="numeric"
                    placeholder="tt:mm"
                    autoComplete="off"
                    value={closesAtTime}
                    onChange={(event) => setClosesAtTime(event.target.value)}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Tid i Europe/Oslo. La begge felt stå tomme for å fjerne sluttidspunkt. Nytt tidspunkt må ligge i
                fremtiden.
              </p>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-foreground">Kilde</span>
              <a
                href={stortingetPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-brand hover:bg-muted',
                  VURDER_FOCUS_RING,
                )}
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                <span className="break-all">{stortingetPageUrl}</span>
              </a>
            </div>

            {fieldError ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
          </div>
        )}
      </Dialog>

      <AdminToast message={message} variant={variant} />
    </>
  );
}
