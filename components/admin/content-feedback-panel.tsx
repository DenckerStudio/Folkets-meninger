'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

type AspectMark = '+' | '-' | null;

export type ContentFeedbackPanelProps = {
  contentType: ContentFeedbackType;
  contentId: string;
  /** When set, verdict cannot be changed (e.g. after Reels publish/archive). */
  lockedVerdict?: ContentFeedbackVerdict;
  initialVerdict?: ContentFeedbackVerdict;
  snapshot?: Record<string, unknown>;
  title?: string;
  description?: string;
  onSkip: () => void;
  onSaved?: () => void;
  className?: string;
};

function markLabel(mark: AspectMark): string {
  if (mark === '+') return '👍';
  if (mark === '-') return '👎';
  return '–';
}

export function ContentFeedbackPanel({
  contentType,
  contentId,
  lockedVerdict,
  initialVerdict = 'neutral',
  snapshot,
  title = 'Tilbakemelding',
  description = 'Merker hva som fungerte eller ikke, slik at vi kan forbedre innholdet.',
  onSkip,
  onSaved,
  className,
}: ContentFeedbackPanelProps) {
  const [verdict, setVerdict] = useState<ContentFeedbackVerdict>(
    lockedVerdict ?? initialVerdict,
  );
  const [aspects, setAspects] = useState<ContentFeedbackAspects>(() => emptyAspects());
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveVerdict = lockedVerdict ?? verdict;

  const rejectionIncomplete = useMemo(() => {
    if (effectiveVerdict !== 'reject') return false;
    return !hasNegativeAspect(aspects) && reasonTags.length === 0;
  }, [aspects, effectiveVerdict, reasonTags]);

  function setAspect(key: ContentFeedbackAspectKey, mark: AspectMark) {
    setAspects((prev) => ({ ...prev, [key]: mark }));
  }

  function toggleReason(tag: string) {
    setReasonTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  }

  async function save() {
    setError('');
    if (rejectionIncomplete) {
      setError('Ved avvisning må minst ett aspekt merkes med 👎 eller minst én grunn velges.');
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

  return (
    <section
      className={cn(
        'rounded-2xl border border-brand/25 bg-brand/5 p-4 sm:p-5',
        className,
      )}
      aria-labelledby="content-feedback-panel-title"
    >
      <div className="space-y-1">
        <h3 id="content-feedback-panel-title" className="text-sm font-semibold text-foreground">
          {title}
        </h3>
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
              onClick={() => setVerdict(option.value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
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

      <div className="mt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aspekter</p>
        <ul className="space-y-2">
          {CONTENT_FEEDBACK_ASPECT_KEYS.map((key) => {
            const mark = aspects[key] ?? null;
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium text-foreground">
                  {CONTENT_FEEDBACK_ASPECT_LABELS[key]}
                </span>
                <div className="flex gap-1.5">
                  {(['+', '-', null] as AspectMark[]).map((value) => (
                    <button
                      key={value ?? 'neutral'}
                      type="button"
                      aria-label={`${CONTENT_FEEDBACK_ASPECT_LABELS[key]}: ${value === '+' ? 'bra' : value === '-' ? 'dårlig' : 'nøytral'}`}
                      onClick={() => setAspect(key, value)}
                      className={cn(
                        'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border text-sm',
                        mark === value
                          ? 'border-brand bg-brand/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      {markLabel(value)}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grunner (hurtigvalg)
        </p>
        <div className="flex flex-wrap gap-2">
          {CONTENT_FEEDBACK_REASON_TAGS.map((item) => {
            const active = reasonTags.includes(item.tag);
            return (
              <button
                key={item.tag}
                type="button"
                onClick={() => toggleReason(item.tag)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
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

      <div className="mt-4 space-y-2">
        <label htmlFor="content-feedback-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notat (valgfritt)
        </label>
        <textarea
          id="content-feedback-note"
          value={note}
          maxLength={1000}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          placeholder="Utdyp kort hvis det hjelper neste generering …"
        />
        <p className="text-right text-xs text-muted-foreground">{note.length}/1000</p>
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Hopp over
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || rejectionIncomplete}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Lagre tilbakemelding
        </button>
      </div>
    </section>
  );
}
