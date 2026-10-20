'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { ChevronDown, Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
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

export type ContentFeedbackPanelProps = {
  contentType: ContentFeedbackType;
  contentId: string;
  /** When set, verdict cannot be changed (e.g. after Reels publish/archive). */
  lockedVerdict?: ContentFeedbackVerdict;
  initialVerdict?: ContentFeedbackVerdict;
  /** Shown under the panel title (e.g. Reels-utkastets tittel). */
  contentSubjectTitle?: string;
  snapshot?: Record<string, unknown>;
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
  initialVerdict = 'neutral',
  contentSubjectTitle,
  snapshot,
  title = 'Tilbakemelding',
  description = 'Merker hva som fungerte eller ikke, slik at vi kan forbedre innholdet.',
  onSkip,
  onSaved,
  className,
}: ContentFeedbackPanelProps) {
  const titleId = useId();
  const noteId = useId();
  const [verdict, setVerdict] = useState<ContentFeedbackVerdict>(
    lockedVerdict ?? initialVerdict,
  );
  const [aspects, setAspects] = useState<ContentFeedbackAspects>(() => emptyAspects());
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [aspectsExpanded, setAspectsExpanded] = useState(false);

  const effectiveVerdict = lockedVerdict ?? verdict;
  const isReject = effectiveVerdict === 'reject';
  const isApprove = effectiveVerdict === 'approve';

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

  const rejectionIncomplete = useMemo(() => {
    if (!isReject) return false;
    return !hasNegativeAspect(aspects) && reasonTags.length === 0;
  }, [aspects, isReject, reasonTags]);

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
    if (rejectionIncomplete) {
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
          snapshot: snapshot ?? {},
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Kunne ikke lagre');
        return;
      }
      onSaved?.();
    } catch {
      setError('Kunne ikke lagre');
    } finally {
      setSaving(false);
    }
  }

  const showAspectList = isReject || aspectsExpanded;

  return (
    <section
      className={cn(
        'rounded-2xl border border-brand/25 bg-brand/5 p-4 sm:p-5',
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="space-y-1">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        {contentSubjectTitle ? (
          <p className="text-sm font-medium text-foreground">{contentSubjectTitle}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {!lockedVerdict ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Dom">
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
              onClick={() => setVerdict(option.value)}
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
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {lockedVerdict === 'approve' ? 'Du publiserte dette utkastet.' : 'Du arkiverte dette utkastet.'}
        </p>
      )}

      {isApprove && !showAspectList ? (
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

      {showAspectList ? (
        <div className="mt-4 space-y-2">
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
          <p className="text-sm font-medium text-foreground">Hva fungerte?</p>
          <ul className="overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-2">
            {CONTENT_FEEDBACK_ASPECT_KEYS.map((key, index) => {
              const mark = aspects[key] ?? null;
              return (
                <li
                  key={key}
                  className={cn(
                    'flex min-h-11 flex-row items-center justify-between gap-3 px-3 py-2',
                    'border-b border-border',
                    index === CONTENT_FEEDBACK_ASPECT_KEYS.length - 1 && 'border-b-0',
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
                          ? 'border-brand bg-brand/10 text-brand'
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

      {isReject ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-foreground">Vanlige grunner</p>
          <div className="flex flex-wrap gap-2">
            {CONTENT_FEEDBACK_REASON_TAGS.map((item) => {
              const active = reasonTags.includes(item.tag);
              return (
                <button
                  key={item.tag}
                  type="button"
                  aria-pressed={active}
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
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <label htmlFor={noteId} className="text-sm font-medium text-foreground">
          Notat (valgfritt)
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={1000}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="w-full min-h-11 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          placeholder="Utdyp kort hvis det hjelper neste generering …"
        />
        <p className="text-right text-xs text-muted-foreground">{note.length}/1000</p>
      </div>

      {rejectionIncomplete ? (
        <p className="mt-2 text-sm text-destructive" role="status" aria-live="polite">
          {REJECTION_HINT}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Hopp over
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || rejectionIncomplete}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Lagre tilbakemelding
        </button>
      </div>
    </section>
  );
}
