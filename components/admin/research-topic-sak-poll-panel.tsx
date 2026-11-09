'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import type { ResearchTopicRow } from '@/lib/admin/research/topic-types';
import {
  buildResearchTopicSakPollFormValidationInput,
  researchTopicSakPollCanCreate,
  validateResearchTopicSakPollIngress,
} from '@/lib/admin/research/topic-sak-poll-client';
import { POLL_BALLOT_BUTTON_ORDER } from '@/lib/polls/ballot-buttons';
import { pollChoiceLabel } from '@/lib/polls/labels';
import {
  STORTINGET_POLL_NEUTRAL_SUMMARY_MAX,
  STORTINGET_POLL_TITLE_MAX,
  validateStortingetPollAdminForm,
} from '@/lib/polls/stortinget-poll-admin';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type SakPollState = {
  issueId: string | null;
  pollId: string | null;
  pollStatus: string | null;
  suggestedIssueId: string;
  defaultTitle: string | null;
  defaultNeutralSummary: string;
  defaultNeutralSummaryTruncated: boolean;
  defaultNeutralSummaryHasContent: boolean;
  stortingetPageUrl: string | null;
  titleOverLimit: boolean;
  dedicatedSak: boolean;
  sourceUrls: { label?: string; url: string }[];
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

export function ResearchTopicSakPollPanel({ topic }: { topic: ResearchTopicRow }) {
  const canCreate = researchTopicSakPollCanCreate(topic);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [state, setState] = useState<SakPollState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'form' | 'confirm'>('form');
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [neutralSummary, setNeutralSummary] = useState('');
  const [closesAtDate, setClosesAtDate] = useState('');
  const [closesAtTime, setClosesAtTime] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [publishForceNew, setPublishForceNew] = useState(false);
  const [publishedNotice, setPublishedNotice] = useState(false);
  const [confirmNewError, setConfirmNewError] = useState<string | null>(null);
  const formErrorId = useId();
  const footerErrorRef = useRef<HTMLParagraphElement>(null);

  const refreshState = useCallback(async () => {
    setLookupLoading(true);
    setLookupFailed(false);
    try {
      const res = await fetch(
        `/api/admin/research/topics/${encodeURIComponent(topic.id)}/sak-poll`,
        { cache: 'no-store' },
      );
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setLookupFailed(true);
        setState(null);
        return;
      }
      if (body.can_create !== true) {
        setState(null);
        return;
      }
      setState({
        issueId: typeof body.issue_id === 'string' ? body.issue_id : null,
        pollId: typeof body.poll_id === 'string' ? body.poll_id : null,
        pollStatus: typeof body.poll_status === 'string' ? body.poll_status : null,
        suggestedIssueId:
          typeof body.suggested_issue_id === 'string' ? body.suggested_issue_id : '',
        defaultTitle: typeof body.default_title === 'string' ? body.default_title : null,
        defaultNeutralSummary:
          typeof body.default_neutral_summary === 'string' ? body.default_neutral_summary : '',
        defaultNeutralSummaryTruncated: body.default_neutral_summary_truncated === true,
        defaultNeutralSummaryHasContent: body.default_neutral_summary_has_content === true,
        stortingetPageUrl:
          typeof body.stortinget_page_url === 'string' ? body.stortinget_page_url : null,
        titleOverLimit: body.title_over_limit === true,
        dedicatedSak: body.dedicated_sak === true,
        sourceUrls: Array.isArray(body.source_urls)
          ? (body.source_urls as { label?: string; url: string }[])
          : [],
      });
    } catch {
      setLookupFailed(true);
      setState(null);
    } finally {
      setLookupLoading(false);
    }
  }, [topic.id]);

  useEffect(() => {
    if (canCreate) void refreshState();
  }, [canCreate, refreshState]);

  const hasLink = Boolean(state?.issueId && state?.pollId);

  function openDialog(fromRepublish = false) {
    if (!state) return;
    setTitle(state.defaultTitle ?? '');
    setNeutralSummary(
      state.defaultNeutralSummaryHasContent ? state.defaultNeutralSummary : '',
    );
    setClosesAtDate('');
    setClosesAtTime('');
    setFieldError(null);
    setConfirmNewError(null);
    setPublishForceNew(fromRepublish);
    setPublishedNotice(false);
    setDialogStep('form');
    setDialogOpen(true);
  }

  function closeDialog() {
    if (pending) return;
    setDialogOpen(false);
    setDialogStep('form');
  }

  function buildPayload(forceNew: boolean) {
    return {
      issue_id: state?.suggestedIssueId,
      title: resolvedTitleForSubmit(),
      neutral_summary: resolvedNeutralSummaryForSubmit(),
      closes_at_date: closesAtDate,
      closes_at_time: closesAtTime,
      source_urls: state?.sourceUrls ?? [],
      force_new: forceNew,
    };
  }

  async function executePublish(forceNew: boolean) {
    const publishFromConfirmNew = confirmNewOpen && !dialogOpen;
    setError('');
    setFieldError(null);
    setConfirmNewError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/admin/research/topics/${encodeURIComponent(topic.id)}/sak-poll`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload(forceNew)),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        needs_confirm_for_new?: boolean;
        poll_id?: string;
        issue_id?: string;
      };
      if (!res.ok) {
        if (body.needs_confirm_for_new) {
          setConfirmNewOpen(true);
          setDialogOpen(false);
          return;
        }
        const message =
          typeof body.message === 'string' && body.message.trim()
            ? body.message
            : 'Kunne ikke publisere avstemning';
        if (publishFromConfirmNew) {
          setConfirmNewError(message);
        } else {
          setFieldError(message);
          setDialogOpen(true);
          setDialogStep('form');
        }
        return;
      }
      setDialogOpen(false);
      setConfirmNewOpen(false);
      setConfirmNewError(null);
      setPublishForceNew(false);
      setPublishedNotice(true);
      await refreshState();
    } catch {
      const message = 'Kunne ikke publisere avstemning';
      if (publishFromConfirmNew) {
        setConfirmNewError(message);
      } else {
        setFieldError(message);
        setDialogOpen(true);
        setDialogStep('form');
      }
    } finally {
      setPending(false);
    }
  }

  function resolvedTitleForSubmit(): string {
    return title.trim() || state?.defaultTitle || '';
  }

  function resolvedNeutralSummaryForSubmit(): string {
    return (
      neutralSummary.trim() ||
      (state?.defaultNeutralSummaryHasContent ? state.defaultNeutralSummary : '')
    );
  }

  function buildFormValidationInput() {
    return buildResearchTopicSakPollFormValidationInput({
      suggestedIssueId: state?.suggestedIssueId ?? '',
      title: resolvedTitleForSubmit(),
      neutralSummary: resolvedNeutralSummaryForSubmit(),
      closesAtDate,
      closesAtTime,
    });
  }

  function handlePrimaryFormClick() {
    const ingressError = validateResearchTopicSakPollIngress(resolvedNeutralSummaryForSubmit());
    if (ingressError) {
      setFieldError(ingressError);
      footerErrorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    const validated = validateStortingetPollAdminForm(buildFormValidationInput());
    if (!validated.ok) {
      setFieldError(validated.error);
      footerErrorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    setFieldError(null);
    setDialogStep('confirm');
  }

  if (!canCreate) {
    return null;
  }

  const dialogDescription =
    dialogStep === 'confirm'
      ? 'Bekreft før avstemningen blir synlig for alle.'
      : 'Avstemningen blir synlig for alle med en gang du publiserer.';

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-card p-4"
      aria-labelledby="research-topic-sak-poll-heading"
    >
      <div className="space-y-1">
        <h2 id="research-topic-sak-poll-heading" className="text-base font-semibold text-foreground">
          Sak og avstemning
        </h2>
        <p className="text-sm text-muted-foreground">
          Kobler briefen til en sak og publiserer en offentlig {ballotSectionPhrase()}. Valget er
          synlig med én gang etter publisering.
        </p>
      </div>

      {lookupFailed ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
          role="alert"
        >
          <p className="min-w-0 flex-1">Kunne ikke sjekke kobling til sak og avstemning.</p>
          <button
            type="button"
            disabled={lookupLoading}
            onClick={() => void refreshState()}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'min-h-11 shrink-0',
            )}
          >
            Prøv igjen
          </button>
        </div>
      ) : null}

      {lookupLoading ? (
        <div className="h-11 w-full max-w-md animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {publishedNotice ? (
            <p className="w-full text-sm text-foreground" role="status">
              Publisert – synlig for alle nå.
            </p>
          ) : null}
          {hasLink && state?.issueId ? (
            <Link
              href={routes.sak(state.issueId)}
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'min-h-11 gap-1.5')}
            >
              Åpne sak
            </Link>
          ) : null}
          {hasLink && state?.pollId ? (
            <Link
              href={routes.poll(state.pollId)}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-11 gap-1.5')}
            >
              Se avstemningen
            </Link>
          ) : null}
          <button
            type="button"
            disabled={pending || lookupFailed || !state?.defaultTitle}
            onClick={() => (hasLink ? setConfirmNewOpen(true) : openDialog())}
            className={cn(buttonVariants({ variant: hasLink ? 'outline' : 'default', size: 'sm' }), 'min-h-11 gap-1.5')}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {hasLink ? 'Publiser ny avstemning' : 'Opprett sak og avstemning'}
          </button>
        </div>
      )}

      {!lookupLoading && state?.defaultTitle && state.titleOverLimit ? (
        <p className="text-sm text-muted-foreground" role="status">
          Tittelen fra briefen er lengre enn {STORTINGET_POLL_TITLE_MAX} tegn — rediger i dialogen
          før publisering.
        </p>
      ) : null}

      {!lookupLoading && !lookupFailed && state && !state.defaultTitle ? (
        <p className="text-sm text-destructive" role="alert">
          Briefen mangler tittel – kjør briefen på nytt.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        title={dialogStep === 'confirm' ? 'Publisere nå?' : 'Publiser sak og avstemning'}
        description={dialogDescription}
        size="lg"
        className="sm:max-w-lg"
        footer={
          dialogStep === 'confirm' ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setDialogStep('form')}
                className={BTN_SECONDARY}
              >
                Tilbake
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void executePublish(publishForceNew)}
                className={BTN_PRIMARY}
              >
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Publiser nå
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={pending} onClick={closeDialog} className={BTN_SECONDARY}>
                Avbryt
              </button>
              <button type="button" disabled={pending} onClick={handlePrimaryFormClick} className={BTN_PRIMARY}>
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Neste
              </button>
            </div>
          )
        }
      >
        {dialogStep === 'form' ? (
          <div className="space-y-4">
            {state?.dedicatedSak ? (
              <p className="text-sm text-muted-foreground">
                Det opprettes en egen sak i Folkets meninger (ikke en eksisterende Stortinget-sak).
              </p>
            ) : state?.stortingetPageUrl ? (
              <p className="text-sm text-muted-foreground">
                Kobles til eksisterende Stortinget-sak.{' '}
                <a
                  href={state.stortingetPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Stortingets side
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              </p>
            ) : null}

            {fieldError ? (
              <p
                ref={footerErrorRef}
                id={formErrorId}
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {fieldError}
              </p>
            ) : null}

            <div className="space-y-1">
              <label htmlFor="research-sak-poll-title" className="text-sm font-medium text-foreground">
                Tittel (maks {STORTINGET_POLL_TITLE_MAX} tegn)
              </label>
              <input
                id="research-sak-poll-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD_CLASS}
                maxLength={STORTINGET_POLL_TITLE_MAX}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="research-sak-poll-ingress"
                className="text-sm font-medium text-foreground"
              >
                Nøytral ingress (maks {STORTINGET_POLL_NEUTRAL_SUMMARY_MAX} tegn)
              </label>
              <textarea
                id="research-sak-poll-ingress"
                value={neutralSummary}
                onChange={(e) => setNeutralSummary(e.target.value)}
                className={TEXTAREA_CLASS}
                maxLength={STORTINGET_POLL_NEUTRAL_SUMMARY_MAX}
              />
              {state?.defaultNeutralSummaryTruncated ? (
                <p className="text-xs text-muted-foreground">
                  Forslaget fra briefen ble forkortet til maks {STORTINGET_POLL_NEUTRAL_SUMMARY_MAX}{' '}
                  tegn. Les gjennom og skriv inn hele ingressen du vil publisere.
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="research-sak-poll-date" className="text-sm font-medium text-foreground">
                  Valgfri sluttdato (dd.mm.åååå)
                </label>
                <input
                  id="research-sak-poll-date"
                  value={closesAtDate}
                  onChange={(e) => setClosesAtDate(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="31.12.2026"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="research-sak-poll-time" className="text-sm font-medium text-foreground">
                  Klokkeslett (tt:mm, Europe/Oslo)
                </label>
                <input
                  id="research-sak-poll-time"
                  value={closesAtTime}
                  onChange={(e) => setClosesAtTime(e.target.value)}
                  className={FIELD_CLASS}
                  placeholder="23:59"
                  inputMode="numeric"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Velgerne kan stemme {ballotWarningPhrase()}.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-foreground">
            <p className="line-clamp-4">
              <span className="font-medium">Tittel:</span> {resolvedTitleForSubmit()}
            </p>
            <p className="line-clamp-4">
              <span className="font-medium">Ingress:</span> {resolvedNeutralSummaryForSubmit()}
            </p>
            <p className="text-muted-foreground">
              Avstemningen blir offentlig med en gang. Systemavstemninger på samme sak arkiveres
              automatisk.
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={confirmNewOpen}
        onClose={() => {
          if (!pending) setConfirmNewOpen(false);
        }}
        title="Ny avstemning på briefen?"
        description="Det finnes allerede en koblet sak og avstemning. Publisering oppdaterer den åpne Stortinget-avstemningen på saken (tittel, ingress, kilder og valgfri sluttid). En aktiv systemavstemning på saken arkiveres automatisk."
        size="md"
        className="sm:max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmNewOpen(false)}
              disabled={pending}
              className={BTN_SECONDARY}
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmNewOpen(false);
                openDialog(true);
              }}
              disabled={pending}
              className={BTN_PRIMARY}
            >
              Rediger og publiser
            </button>
            <button
              type="button"
              onClick={() => void executePublish(true)}
              disabled={pending}
              className={BTN_SECONDARY}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Publiser likevel
            </button>
          </div>
        }
      >
        {confirmNewError ? (
          <p className="mb-3 text-sm font-medium text-destructive" role="alert">
            {confirmNewError}
          </p>
        ) : null}
        <span className="sr-only">Bekreft ny sak eller avstemning fra tema-brief</span>
      </Dialog>
    </section>
  );
}
