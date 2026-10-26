'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ChevronDown, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  CONTENT_FEEDBACK_ASPECT_KEYS,
  CONTENT_FEEDBACK_ASPECT_LABELS,
  CONTENT_FEEDBACK_REASON_TAGS,
  emptyAspects,
  hasNegativeAspect,
  type ContentFeedbackAspectKey,
} from '@/lib/content-feedback/constants';
import type {
  ContentFeedbackAspects,
  ContentFeedbackType,
  ContentFeedbackVerdict,
} from '@/lib/content-feedback/types';
import { cn } from '@/lib/utils';

type AspectMark = '+' | '-';

const REJECTION_HINT =
  'Ved avvisning må minst ett aspekt merkes med tommel ned eller minst én grunn velges.';
const EYEBROW_LABEL = 'Tilbakemelding';
const SUCCESS_MESSAGE = 'Takk, tilbakemeldingen er lagret.';
const SAVE_ERROR_MESSAGE = 'Kunne ikke lagre. Prøv igjen.';
const VERDICT_REQUIRED = 'Velg en dom før du lagrer.';

const SAVE_CLOSE_DELAY_MS = 4000;

export type ContentFeedbackPanelProps = {
  contentType: ContentFeedbackType;
  contentId: string;
  /** When set, verdict cannot be changed (e.g. after Reels publish/archive). */
  lockedVerdict?: ContentFeedbackVerdict;
  /** Shown under the panel title (e.g. Reels-utkastets tittel). */
  contentSubjectTitle?: string;
  /** Innholdet som ble vurdert. Vises i kortet etter at utkastet er borte fra listen. */
  preview?: ReactNode;
  title?: string;
  description?: string;
  onSkip: () => void;
  onSaved?: () => void;
  className?: string;
};

export function ContentFeedbackPanel({
  contentType,
  contentId,
  lockedVerdict,
  contentSubjectTitle,
  preview,
  title = 'Tilbakemelding',
  description = 'Merker hva som fungerte eller ikke, slik at vi kan forbedre innholdet.',
  onSkip,
  onSaved,
  className,
}: ContentFeedbackPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const verdictGroupId = useId();
  const rejectHintId = useId();
  const [verdict, setVerdict] = useState<ContentFeedbackVerdict | null>(
    lockedVerdict ?? null,
  );
  const [aspects, setAspects] = useState<ContentFeedbackAspects>(() => emptyAspects());
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [verdictError, setVerdictError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [showAdminReviewedBadge, setShowAdminReviewedBadge] = useState(false);
  const [aspectsExpanded, setAspectsExpanded] = useState(false);
  const [rejectSubmitAttempted, setRejectSubmitAttempted] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const aspectsPanelRef = useRef<HTMLDivElement>(null);

  const effectiveVerdict = lockedVerdict ?? verdict;
  const isReject = effectiveVerdict === 'reject';
  const isApprove = effectiveVerdict === 'approve';

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setSaveSucceeded(false);
    setSuccess('');
    setError('');
    setRejectSubmitAttempted(false);
  }, [contentType, contentId]);

  useEffect(() => {
    if (lockedVerdict) {
      setLoadingExisting(false);
      return;
    }
    let cancelled = false;
    setLoadingExisting(true);
    setError('');
    const params = new URLSearchParams({
      content_type: contentType,
      content_id: contentId,
    });
    void fetch(`/api/admin/content-feedback?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          feedback?: {
            source?: string;
            verdict: ContentFeedbackVerdict;
            aspects?: ContentFeedbackAspects;
            reason_tags?: string[];
            note?: string | null;
          } | null;
        };
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            return;
          }
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke laste tilbakemelding');
          return;
        }
        const row = json.feedback;
        if (!row || lockedVerdict || row.source !== 'admin') {
          return;
        }
        setShowAdminReviewedBadge(true);
        if (row.verdict === 'approve' || row.verdict === 'reject') {
          setVerdict(row.verdict);
        }
        if (row.aspects) {
          setAspects({ ...emptyAspects(), ...row.aspects });
        }
        if (Array.isArray(row.reason_tags)) {
          setReasonTags(row.reason_tags);
        }
        if (typeof row.note === 'string') {
          setNote(row.note);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Kunne ikke laste tilbakemelding');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId, lockedVerdict]);

  useEffect(() => {
    if (isReject) {
      setAspectsExpanded(true);
    }
  }, [isReject]);

  useEffect(() => {
    if (isApprove) {
      setAspectsExpanded(false);
    }
  }, [isApprove]);

  useEffect(() => {
    if (!aspectsExpanded || !isApprove) return;
    const firstControl = aspectsPanelRef.current?.querySelector<HTMLElement>(
      'button[aria-label*="tommel"]',
    );
    firstControl?.focus();
  }, [aspectsExpanded, isApprove]);

  const rejectionIncomplete = useMemo(() => {
    if (!isReject) return false;
    return !hasNegativeAspect(aspects) && reasonTags.length === 0;
  }, [aspects, isReject, reasonTags]);

  const verdictMissing = !lockedVerdict && verdict == null;

  function toggleAspectMark(key: ContentFeedbackAspectKey, mark: AspectMark) {
    setAspects((prev) => {
      const current = prev[key] ?? null;
      const next = current === mark ? null : mark;
      return { ...prev, [key]: next };
    });
  }

  function toggleReason(tag: string) {
    setReasonTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }

  async function save() {
    setError('');
    setVerdictError('');
    setSuccess('');

    if (verdictMissing) {
      setVerdictError(VERDICT_REQUIRED);
      return;
    }
    if (rejectionIncomplete) {
      setRejectSubmitAttempted(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/content-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          verdict: effectiveVerdict,
          aspects,
          reason_tags: reasonTags,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        regeneration?: boolean;
        regeneration_hint?: string | null;
      };
      if (!res.ok) {
        setError(SAVE_ERROR_MESSAGE);
        return;
      }
      setShowAdminReviewedBadge(true);
      const savedMessage =
        json.regeneration === false && json.regeneration_hint
          ? json.regeneration_hint
          : SUCCESS_MESSAGE;
      setSuccess(savedMessage);
      setSaveSucceeded(true);
      if (onSaved) {
        closeTimerRef.current = window.setTimeout(() => {
          closeTimerRef.current = null;
          skipRef.current?.focus();
          onSaved();
        }, SAVE_CLOSE_DELAY_MS);
      }
    } catch {
      setError(SAVE_ERROR_MESSAGE);
    } finally {
      setSaving(false);
    }
  }

  const saveLocked = saving || saveSucceeded;
  const headingText = preview ? title : (contentSubjectTitle ?? title);

  const showAspectList = isReject || aspectsExpanded;
  const showRejectAlert = isReject && rejectionIncomplete && rejectSubmitAttempted;
  const statusMessage =
    error ||
    verdictError ||
    (showRejectAlert ? REJECTION_HINT : '');

  return (
    <section
      className={cn(
        'rounded-2xl border border-brand/25 bg-brand/5 p-4 sm:p-5',
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="w-full text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {EYEBROW_LABEL}
          </p>
          <h3 id={titleId} className="text-sm font-semibold text-foreground">
            {headingText}
          </h3>
          {showAdminReviewedBadge ? (
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Vurdert
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {preview ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">{preview}</div>
      ) : null}

      <div className="mt-2 min-h-[1.25rem]" aria-live="polite" aria-atomic="true">
        {success ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
        ) : null}
        {statusMessage ? (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{statusMessage}</span>
          </p>
        ) : null}
      </div>

      {loadingExisting ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Laster tidligere tilbakemelding …
        </p>
      ) : null}

      {!lockedVerdict && !loadingExisting ? (
        <div className="mt-4 space-y-1">
          <p id={verdictGroupId} className="text-sm font-medium text-foreground">
            Dom{' '}
            <span className="text-xs font-normal text-muted-foreground">(påkrevd)</span>
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={verdictGroupId}>
            {(
              [
                { value: 'approve' as const, label: 'Godkjenn' },
                { value: 'reject' as const, label: 'Avvis' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={verdict === option.value}
                onClick={() => {
                  setVerdict(option.value);
                  setVerdictError('');
                }}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  verdict === option.value
                    ? 'border-brand bg-brand/15 text-brand'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : lockedVerdict ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {lockedVerdict === 'approve' ? 'Du publiserte dette utkastet.' : 'Du arkiverte dette utkastet.'}
        </p>
      ) : null}

      {!loadingExisting && isApprove && !showAspectList ? (
        <button
          type="button"
          onClick={() => setAspectsExpanded(true)}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-muted/40"
          aria-expanded={false}
        >
          Merk deler (valgfritt)
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ) : null}

      {!loadingExisting && isReject ? (
        <p className="mt-4 text-sm text-muted-foreground">(minst ett av disse)</p>
      ) : null}

      {!loadingExisting && showAspectList ? (
        <div
          ref={aspectsPanelRef}
          className={cn('space-y-2', isReject ? 'mt-2' : 'mt-4')}
        >
          {isApprove ? (
            <button
              type="button"
              onClick={() => setAspectsExpanded(false)}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              aria-expanded={true}
            >
              <ChevronDown className="h-4 w-4 rotate-180" aria-hidden />
              Skjul merking
            </button>
          ) : null}
          <p className="text-sm font-medium text-foreground">
            {isReject ? 'Merk deler' : 'Merk deler (valgfritt)'}
          </p>
          <ul
            className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-2 lg:divide-y-0"
          >
            {CONTENT_FEEDBACK_ASPECT_KEYS.map((key, index) => {
              const mark = aspects[key] ?? null;
              return (
                <li
                  key={key}
                  className={cn(
                    'flex min-h-11 flex-row items-center justify-between gap-3 px-3 py-2',
                    'lg:border-b lg:border-border',
                    index === CONTENT_FEEDBACK_ASPECT_KEYS.length - 1 && 'lg:border-b-0',
                    index >= CONTENT_FEEDBACK_ASPECT_KEYS.length - 2 && 'lg:border-b-0',
                    index % 2 === 1 && 'lg:border-l lg:border-border',
                  )}
                  role="radiogroup"
                  aria-label={CONTENT_FEEDBACK_ASPECT_LABELS[key]}
                >
                  <span className="text-sm font-medium text-foreground">
                    {CONTENT_FEEDBACK_ASPECT_LABELS[key]}
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mark === '+'}
                      aria-label={`${CONTENT_FEEDBACK_ASPECT_LABELS[key]}: tommel opp`}
                      onClick={() => toggleAspectMark(key, '+')}
                      className={cn(
                        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border',
                        mark === '+'
                          ? 'border-brand bg-brand/10 text-brand'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={mark === '-'}
                      aria-label={`${CONTENT_FEEDBACK_ASPECT_LABELS[key]}: tommel ned`}
                      onClick={() => toggleAspectMark(key, '-')}
                      className={cn(
                        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border',
                        mark === '-'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      <ThumbsDown className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {!loadingExisting && isReject ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Vanlige grunner</p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_FEEDBACK_REASON_TAGS.map((item, index) => {
              const active = reasonTags.includes(item.tag);
              return (
                <button
                  key={item.tag}
                  type="button"
                  aria-pressed={active}
                  aria-describedby={index === 0 ? rejectHintId : undefined}
                  onClick={() => toggleReason(item.tag)}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-brand bg-brand/15 text-brand'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/40',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {!showRejectAlert ? (
            <p id={rejectHintId} className="text-sm text-muted-foreground">
              {REJECTION_HINT}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loadingExisting ? (
        <div className="mt-4 space-y-2">
          <label htmlFor={noteId} className="text-sm font-medium text-foreground">
            Notat (valgfritt)
          </label>
          <textarea
            id={noteId}
            name="note"
            value={note}
            maxLength={1000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            className="w-full min-h-11 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            placeholder="Utdyp kort hvis det hjelper neste generering …"
          />
          <p className="text-right text-xs text-muted-foreground">{note.length}/1000</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          ref={skipRef}
          type="button"
          onClick={onSkip}
          disabled={saveLocked}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Hopp over
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveLocked || loadingExisting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Lagre tilbakemelding
        </button>
      </div>
    </section>
  );
}
