'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ComposerStemmeAssists } from '@/components/opinions/composer-stemme-assists';
import { OpinionPointsEditor } from '@/components/opinions/opinion-points-editor';
import { SakPicker } from '@/components/opinions/sak-picker';
import { STANCE_VISUAL } from '@/lib/opinions/labels';
import {
  OPINION_BODY_MAX,
  OPINION_BODY_MIN,
  OPINION_TITLE_MAX,
  OPINION_TITLE_MIN,
  type OpinionCreateStance,
  type OpinionPoint,
  type SakPickerOption,
} from '@/lib/opinions/types';
import {
  clearOpinionComposerDraft,
  hasOpinionComposerDraftContent,
  readOpinionComposerDraft,
  resolveOpinionComposerDraft,
  writeOpinionComposerDraft,
} from '@/lib/opinions/draft';
import {
  describeOpinionComposerGaps,
  emptyOpinionPointDrafts,
  hasOpinionFieldErrors,
  validateOpinionDraft,
  validateOpinionPoints,
} from '@/lib/opinions/validate';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const CREATE_STANCE_ORDER = ['imot', 'for'] as const satisfies readonly OpinionCreateStance[];

type ComposerBannerProps = {
  sakOptions: SakPickerOption[];
};

export function ComposerBanner({ sakOptions }: ComposerBannerProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [issueId, setIssueId] = useState<string | null>(null);
  const [stance, setStance] = useState<OpinionCreateStance | null>(null);
  const [points, setPoints] = useState<OpinionPoint[]>(emptyOpinionPointDrafts);
  const [error, setError] = useState('');
  const [pointsError, setPointsError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const editedRef = useRef(false);
  const publishedRef = useRef(false);
  const appliedIdentityRef = useRef<string | undefined>(undefined);

  function markEdited() {
    editedRef.current = true;
    publishedRef.current = false;
  }

  const [remoteOptions, setRemoteOptions] = useState<SakPickerOption[]>([]);
  const [loadingSaker, setLoadingSaker] = useState(sakOptions.length === 0);

  useEffect(() => {
    if (sakOptions.length > 0) {
      setLoadingSaker(false);
      return;
    }
    let cancelled = false;
    setLoadingSaker(true);
    fetch('/api/opinions/sak-options')
      .then((res) => (res.ok ? res.json() : { options: [] }))
      .then((data: { options?: SakPickerOption[] }) => {
        if (!cancelled && Array.isArray(data.options)) {
          setRemoteOptions(data.options);
        }
      })
      .catch(() => {
        if (!cancelled) setRemoteOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSaker(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sakOptions.length]);

  useEffect(() => {
    if (!draftReady) return;
    if (appliedIdentityRef.current !== (userId ?? '')) return;
    const draft = { title, issueId, stance, body, points };
    if (publishedRef.current || !hasOpinionComposerDraftContent(draft)) {
      clearOpinionComposerDraft(window.localStorage, userId);
      return;
    }
    writeOpinionComposerDraft(window.localStorage, userId, draft);
  }, [body, draftReady, issueId, points, stance, title, userId]);

  useEffect(() => {
    if (authLoading) return;
    const identity = userId ?? '';
    if (appliedIdentityRef.current === identity) return;
    const hadIdentity = appliedIdentityRef.current !== undefined;
    if (!editedRef.current) {
      const saved = readOpinionComposerDraft(window.localStorage, userId);
      const draft = resolveOpinionComposerDraft(false, saved);
      if (draft) {
        setTitle(draft.title);
        setBody(draft.body);
        setIssueId(draft.issueId);
        setStance(draft.stance);
        setPoints(draft.points);
        setExpanded(true);
      } else if (hadIdentity) {
        setTitle('');
        setBody('');
        setIssueId(null);
        setStance(null);
        setPoints(emptyOpinionPointDrafts());
      }
    }
    appliedIdentityRef.current = identity;
    setDraftReady(true);
  }, [authLoading, userId]);

  const mergedOptions = useMemo(() => {
    const seen = new Set<string>();
    const merged: SakPickerOption[] = [];
    for (const option of [...sakOptions, ...remoteOptions]) {
      if (!option.id || seen.has(option.id)) continue;
      seen.add(option.id);
      merged.push(option);
    }
    return merged;
  }, [remoteOptions, sakOptions]);

  const selectedIssueTitle = useMemo(() => {
    if (!issueId) return null;
    return mergedOptions.find((option) => option.id === issueId)?.title ?? null;
  }, [issueId, mergedOptions]);

  const titleLength = title.trim().length;
  const bodyLength = body.trim().length;
  const bodyRemaining = Math.max(0, OPINION_BODY_MIN - bodyLength);
  const missingHint = describeOpinionComposerGaps({ issueId, stance, body, points });
  const showDiscard = hasOpinionComposerDraftContent({ title, issueId, stance, body, points });
  const fieldErrors = validateOpinionDraft({
    title,
    body,
    stance,
    points,
  });
  const draftValid = Boolean(issueId) && !hasOpinionFieldErrors(fieldErrors);
  // Signed-out users keep the button enabled so submit can send them to login.
  const canPublish = !busy && (!user || draftValid);
  const livePointsError = fieldErrors.points || pointsError;
  const liveBodyError = bodyLength > 0 && fieldErrors.body ? fieldErrors.body : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.folketsMeninger)}`);
      return;
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < OPINION_TITLE_MIN) {
      setError(`Tittelen må være minst ${OPINION_TITLE_MIN} tegn.`);
      return;
    }
    if (!issueId) {
      setError('Velg en sak før du tar standpunkt.');
      return;
    }
    if (!stance) {
      setError('Velg For eller Imot');
      return;
    }
    const trimmedBody = body.trim();
    if (trimmedBody.length < OPINION_BODY_MIN) {
      setError(`Begrunnelsen må være minst ${OPINION_BODY_MIN} tegn.`);
      return;
    }
    const pointsResult = validateOpinionPoints(points);
    if (pointsResult.error) {
      setPointsError(pointsResult.error);
      setError(pointsResult.error);
      return;
    }
    setBusy(true);
    setError('');
    setPointsError('');
    try {
      const res = await fetch('/api/opinions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          body: trimmedBody,
          stance,
          points: pointsResult.points,
          stortingetIssueId: issueId,
        }),
      });
      const data = (await res.json()) as { error?: string; opinionId?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke publisere meningen');
        return;
      }
      if (data.opinionId) {
        publishedRef.current = true;
        clearOpinionComposerDraft(window.localStorage, userId);
        setTitle('');
        setBody('');
        setIssueId(null);
        setStance(null);
        setPoints(emptyOpinionPointDrafts());
        setError('');
        setPointsError('');
        router.push(routes.opinion(data.opinionId));
        router.refresh();
      }
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  function pickCreateStance(next: OpinionCreateStance) {
    if (!issueId) {
      setError('Velg en sak før du tar standpunkt.');
      return;
    }
    markEdited();
    setStance(next);
    setError('');
  }

  function discardDraft() {
    markEdited();
    publishedRef.current = false;
    setTitle('');
    setBody('');
    setIssueId(null);
    setStance(null);
    setPoints(emptyOpinionPointDrafts());
    setError('');
    setPointsError('');
    clearOpinionComposerDraft(window.localStorage, userId);
  }

  return (
    <section
      data-composer=""
      data-expanded={expanded ? 'true' : 'false'}
      className="relative overflow-hidden rounded-xxl border border-border bg-card"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xxl" aria-hidden>
        <div className="absolute -left-16 -top-20 h-52 w-52 rounded-full bg-brand-accent/15 blur-3xl" />
        <div className="absolute -right-12 top-1/3 h-44 w-44 rounded-full bg-brand/18 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--card)_88%,transparent),_transparent_55%)]" />
      </div>

      {!expanded ? (
        <div className="relative flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className="text-base font-semibold tracking-tight text-foreground">Del din mening</p>
          <button
            type="button"
            data-composer-cta="open"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
          >
            Del din mening
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <form className="relative space-y-5 px-5 py-6 sm:px-8 sm:py-8" onSubmit={submit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Del din mening
              </h2>
              {missingHint ? (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {missingHint}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {showDiscard ? (
                <button
                  type="button"
                  data-composer-cta="discard"
                  onClick={discardDraft}
                  className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline"
                >
                  Forkast utkast
                </button>
              ) : null}
              <button
                type="button"
                data-composer-cta="close"
                onClick={() => setExpanded(false)}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                Skjul
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <label htmlFor="opinion-title" className="text-sm font-medium text-foreground">
                Tittel
              </label>
              <span className="text-xs text-muted-foreground">
                {titleLength}/{OPINION_TITLE_MAX} · minst {OPINION_TITLE_MIN} tegn
              </span>
            </div>
            <input
              id="opinion-title"
              type="text"
              value={title}
              onChange={(event) => {
                markEdited();
                setTitle(event.target.value);
              }}
              placeholder="Tittel på meningen"
              maxLength={OPINION_TITLE_MAX}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <SakPicker
            options={mergedOptions}
            value={issueId}
            onChange={(next) => {
              markEdited();
              setIssueId(next);
              if (!next) setStance(null);
              setError('');
            }}
            context={title}
            loading={loadingSaker && mergedOptions.length === 0}
          />

          <div>
            <p className="mb-1 text-sm font-medium text-foreground">Standpunkt</p>
            {issueId ? (
              <div className="flex overflow-hidden rounded-2xl border border-border">
                {CREATE_STANCE_ORDER.map((choice) => {
                  const visual = STANCE_VISUAL[choice];
                  const selected = stance === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      data-create-stance={choice}
                      aria-pressed={selected}
                      onClick={() => pickCreateStance(choice)}
                      className={cn(
                        'flex-1 px-4 py-3 text-sm font-semibold',
                        !selected && 'bg-card',
                        !selected && choice === 'imot' && 'text-brand-accent',
                        !selected && choice === 'for' && 'text-brand',
                      )}
                      style={
                        selected
                          ? { backgroundColor: visual.bg, color: visual.fg }
                          : undefined
                      }
                    >
                      {visual.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                Velg en sak først, så kan du si For eller Imot.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <label htmlFor="opinion-body" className="text-sm font-medium text-foreground">
                Begrunnelse
              </label>
              <span className="text-xs text-muted-foreground">
                {bodyRemaining > 0
                  ? `${bodyRemaining} tegn igjen til minstekravet`
                  : `${bodyLength}/${OPINION_BODY_MAX} tegn`}
              </span>
            </div>
            <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
              Minst {OPINION_BODY_MIN} tegn, maks {OPINION_BODY_MAX} tegn.
            </p>
            <textarea
              id="opinion-body"
              value={body}
              onChange={(event) => {
                markEdited();
                setBody(event.target.value);
              }}
              rows={7}
              maxLength={OPINION_BODY_MAX}
              placeholder={`Skriv minst ${OPINION_BODY_MIN} tegn om hvorfor du mener dette.`}
              className="w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
            />
            {liveBodyError ? (
              <p className="mt-2 text-sm font-medium text-destructive">{liveBodyError}</p>
            ) : null}
          </div>

          <ComposerStemmeAssists
            body={body}
            title={title}
            issueTitle={selectedIssueTitle}
            onApplyBody={(next) => {
              markEdited();
              setBody(next);
            }}
          />

          <OpinionPointsEditor
            value={points}
            onChange={(next) => {
              markEdited();
              setPoints(next);
              setPointsError('');
            }}
            error={livePointsError}
          />

          {error ? (
            <p className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canPublish}
              aria-disabled={!canPublish}
              title={!canPublish && missingHint ? missingHint : undefined}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Lagrer…' : 'Publiser mening'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}