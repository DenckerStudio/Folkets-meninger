'use client';

import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Columns3, ExternalLink, TriangleAlert } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import {
  approveLocalAiSuggestionAction,
  mergeLocalAiPullAction,
  rejectFailedLocalAiTaskAction,
  rejectLocalAiSuggestionAction,
  requeueFailedLocalAiTaskAction,
  retryMarkLocalAiDraftPrReadyAction,
} from '@/lib/admin/local-ai-hub/actions';
import {
  type LocalAiApproveHubNotice,
  LOCAL_AI_HUB_NOTICE_STORAGE_KEY,
  parseStoredHubNotice,
  serializeHubNotice,
} from '@/lib/admin/local-ai-hub/approve-hub-notice';
import type { LocalAiFinishedRow, LocalAiOverviewResult } from '@/lib/admin/local-ai-hub/overview';
import { routes } from '@/lib/routes';
import { verdictLabel, type ReviewVerdictOutcome } from '@/lib/admin/local-ai-hub/verdict-parser';
import { cn } from '@/lib/utils';

function verdictClass(outcome: ReviewVerdictOutcome): string {
  switch (outcome) {
    case 'pass':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'fail':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function prStatusLabel(pr: NonNullable<LocalAiFinishedRow['pr']>): string {
  if (pr.merged) return 'Merget';
  if (pr.state === 'open') return 'Åpen';
  return 'Lukket';
}

function isInactiveFinishedRow(row: LocalAiFinishedRow): boolean {
  return !row.failed && row.pr !== null && (row.pr.merged || row.pr.state !== 'open');
}

function ciBadgeClass(state: string | undefined): string {
  switch (state) {
    case 'success':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'failure':
      return 'bg-destructive/10 text-destructive';
    case 'pending':
      return 'bg-amber-500/10 text-amber-800 dark:text-amber-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

type Props = {
  initial: LocalAiOverviewResult;
};

export function LocalAiHubPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Laster lokal-AI-oversikt">
      <div className="h-11 w-44 animate-pulse rounded bg-muted/60" />
      <div className="h-20 w-full max-w-2xl animate-pulse rounded bg-muted/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-h-48 animate-pulse rounded-xl border border-border bg-card" />
        <div className="min-h-48 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}

export default function AdminLocalAiHubClient({ initial }: Props) {
  const router = useRouter();
  const [overview, setOverview] = useState(initial);
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<number | null>(null);
  const [mergeConfirmKey, setMergeConfirmKey] = useState<string | null>(null);
  const [pendingMergingKey, setPendingMergingKey] = useState<string | null>(null);
  const [failedRejectConfirmId, setFailedRejectConfirmId] = useState<number | null>(null);
  const [showInactivePrs, setShowInactivePrs] = useState(false);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [hubNotice, setHubNotice] = useState<LocalAiApproveHubNotice | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return parseStoredHubNotice(sessionStorage.getItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY));
    } catch {
      return null;
    }
  });
  const [retryReadyTaskId, setRetryReadyTaskId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const persistHubNotice = useCallback((notice: LocalAiApproveHubNotice | null) => {
    try {
      if (!notice) {
        sessionStorage.removeItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY);
      } else {
        sessionStorage.setItem(LOCAL_AI_HUB_NOTICE_STORAGE_KEY, serializeHubNotice(notice));
      }
    } catch {
      // sessionStorage utilgjengelig
    }
  }, []);

  const applyHubNotice = useCallback(
    (notice: LocalAiApproveHubNotice | undefined) => {
      if (!notice) return;
      setHubNotice(notice);
      persistHubNotice(notice);
    },
    [persistHubNotice],
  );

  const dismissHubNotice = useCallback(() => {
    setHubNotice(null);
    persistHubNotice(null);
  }, [persistHubNotice]);

  const forgetCardError = (key: string) => {
    setCardErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/local-ai-hub/overview');
      const data = (await res.json()) as LocalAiOverviewResult;
      if (res.ok) setOverview(data);
    } catch {
      // beholder forrige data
    }
    router.refresh();
  }, [router]);

  if (!overview.ok && overview.kind === 'config') {
    return (
      <div className="space-y-6">
        <AdminBackLink />
        <header>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            <Columns3 className="h-6 w-6 shrink-0 text-brand" aria-hidden />
            Lokal-AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oversikt over Vikunja-køen og tilknyttede pull requests.
          </p>
        </header>
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">Oppsettet er ufullstendig</p>
          <ul className="mt-2 list-inside list-disc text-sm text-destructive">
            {overview.missing.map((name) => (
              <li key={name}>
                Mangler miljøvariabel <code className="text-xs">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (!overview.ok) {
    return null;
  }

  const failedRows = overview.ferdig.filter((r) => r.failed);
  const doneRows = overview.ferdig.filter((r) => !r.failed);
  const visibleDoneRows = showInactivePrs ? doneRows : doneRows.filter((r) => !isInactiveFinishedRow(r));
  const hiddenInactiveCount = doneRows.filter((r) => isInactiveFinishedRow(r)).length;

  const runApprove = (taskId: number) => {
    setPendingTaskId(taskId);
    startTransition(async () => {
      const res = await approveLocalAiSuggestionAction(taskId);
      setPendingTaskId(null);
      if (!res.ok) {
        setCardErrors((p) => ({ ...p, [`f-${taskId}`]: res.error }));
        return;
      }
      forgetCardError(`f-${taskId}`);
      applyHubNotice(res.hubNotice);
      setRejectConfirmId(null);
      await refresh();
    });
  };

  const runRetryReady = (taskId: number) => {
    setRetryReadyTaskId(taskId);
    startTransition(async () => {
      const res = await retryMarkLocalAiDraftPrReadyAction(taskId);
      setRetryReadyTaskId(null);
      if (!res.ok) {
        setHubNotice({
          variant: 'warning',
          title: 'Advarsel',
          body: res.error,
          taskId,
          canRetryReady: true,
        });
        persistHubNotice({
          variant: 'warning',
          title: 'Advarsel',
          body: res.error,
          taskId,
          canRetryReady: true,
        });
        return;
      }
      applyHubNotice(res.hubNotice);
      await refresh();
    });
  };

  const runReject = (taskId: number) => {
    setPendingTaskId(taskId);
    startTransition(async () => {
      const res = await rejectLocalAiSuggestionAction(taskId);
      setPendingTaskId(null);
      setRejectConfirmId(null);
      if (!res.ok) {
        setCardErrors((p) => ({ ...p, [`f-${taskId}`]: res.error }));
        return;
      }
      forgetCardError(`f-${taskId}`);
      await refresh();
    });
  };

  const runRequeueFailed = (taskId: number) => {
    setPendingTaskId(taskId);
    startTransition(async () => {
      const res = await requeueFailedLocalAiTaskAction(taskId);
      setPendingTaskId(null);
      if (!res.ok) {
        setCardErrors((p) => ({ ...p, [`feilet-${taskId}`]: res.error }));
        return;
      }
      forgetCardError(`feilet-${taskId}`);
      await refresh();
    });
  };

  const runRejectFailed = (taskId: number) => {
    setPendingTaskId(taskId);
    startTransition(async () => {
      const res = await rejectFailedLocalAiTaskAction(taskId);
      setPendingTaskId(null);
      setFailedRejectConfirmId(null);
      if (!res.ok) {
        setCardErrors((p) => ({ ...p, [`feilet-${taskId}`]: res.error }));
        return;
      }
      forgetCardError(`feilet-${taskId}`);
      await refresh();
    });
  };

  const runMerge = (key: string, owner: string, repo: string, number: number, headSha: string) => {
    setPendingMergingKey(key);
    startTransition(async () => {
      const res = await mergeLocalAiPullAction({ owner, repo, number, expectedHeadSha: headSha });
      setMergeConfirmKey(null);
      setPendingMergingKey(null);
      if (!res.ok) {
        setCardErrors((p) => ({ ...p, [key]: res.error }));
        return;
      }
      forgetCardError(key);
      await refresh();
    });
  };

  return (
    <div className="space-y-8">
      <AdminBackLink />
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <Columns3 className="h-6 w-6 shrink-0 text-brand" aria-hidden />
          Lokal-AI
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ferdige kjøringer, forslag til godkjenning og merge når CI og vurdering er på plass. Dev-task-kanban
          finnes fortsatt via lenken under.
        </p>
        <p className="mt-2">
          <Link
            href={`${routes.adminOppgaver}?view=kanban`}
            className={cn(
              'inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline',
              VURDER_FOCUS_RING,
            )}
          >
            Åpne dev-task-kanban
          </Link>
        </p>
      </header>

      {overview.partialErrors.length > 0 ? (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-foreground">Noen datakilder feilet:</p>
          <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
            {overview.partialErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            className={cn('mt-3 min-h-11', VURDER_FOCUS_RING)}
            onClick={() => void refresh()}
          >
            Oppdater
          </Button>
        </div>
      ) : null}

      <section aria-labelledby="lokal-ai-ferdig-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="lokal-ai-ferdig-heading" className="text-lg font-semibold text-foreground">
            Ferdig
          </h2>
          <div className="flex flex-wrap gap-2">
            {hiddenInactiveCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className={cn('min-h-11', VURDER_FOCUS_RING)}
                onClick={() => setShowInactivePrs((v) => !v)}
              >
                {showInactivePrs
                  ? 'Skjul lukkede'
                  : `Vis lukkede (${hiddenInactiveCount})`}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={cn('min-h-11', VURDER_FOCUS_RING)}
              disabled={isPending}
              onClick={() => void refresh()}
            >
              Oppdater
            </Button>
          </div>
        </div>

        {visibleDoneRows.length === 0 && failedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen ferdige oppgaver med PR-etikett akkurat nå.</p>
        ) : null}

        <div className="grid gap-4">
          {visibleDoneRows.map((row) => {
            const mergeKey = `pr-${row.pr?.number ?? row.taskId}`;
            const confirmingMerge = mergeConfirmKey === mergeKey;
            return (
              <article
                key={row.taskId}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{row.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Vikunja #{row.taskId}</p>
                  </div>
                  {row.pr ? (
                    <Link
                      href={row.pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand hover:underline',
                        VURDER_FOCUS_RING,
                      )}
                    >
                      PR #{row.pr.number}
                      <ExternalLink className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : null}
                </div>

                {row.prError ? (
                  <p className="mt-2 text-sm text-destructive" role="alert">
                    {row.prError}
                  </p>
                ) : null}

                {row.pr ? (
                  <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-foreground">Status</dt>
                      <dd>{prStatusLabel(row.pr)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Head SHA</dt>
                      <dd className="font-mono">{row.pr.headSha.slice(0, 12)}…</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">CI</dt>
                      <dd>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 font-medium',
                            ciBadgeClass(row.ci?.state),
                          )}
                        >
                          {row.ci?.summary ?? row.ciError ?? 'Kunne ikke hente CI-status'}
                        </span>
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 font-medium',
                          verdictClass(row.pixel),
                        )}
                      >
                        Pixel: {verdictLabel(row.pixel)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 font-medium',
                          verdictClass(row.friction),
                        )}
                      >
                        Friction: {verdictLabel(row.friction)}
                      </span>
                    </div>
                  </dl>
                ) : null}

                {cardErrors[mergeKey] ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {cardErrors[mergeKey]}
                  </p>
                ) : null}

                {row.pr && row.pr.state === 'open' ? (
                  <div className="mt-4">
                    {!confirmingMerge ? (
                      <div className="space-y-2">
                        <Button
                          type="button"
                          className={cn('min-h-11', VURDER_FOCUS_RING)}
                          disabled={!row.merge.canMerge || isPending}
                          title={
                            row.merge.canMerge
                              ? undefined
                              : row.merge.reasons.join(' · ')
                          }
                          onClick={() => setMergeConfirmKey(mergeKey)}
                        >
                          {pendingMergingKey === mergeKey ? 'Merger …' : 'Squash-merge'}
                        </Button>
                        {!row.merge.canMerge ? (
                          <p className="text-xs text-muted-foreground">
                            {row.merge.reasons.join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div
                        className="space-y-2 rounded-lg border border-border bg-muted/40 p-3"
                        role="region"
                        aria-label="Bekreft merge"
                      >
                        <p className="text-sm font-medium text-foreground">
                          Squash-merge PR #{row.pr.number} på head{' '}
                          <span className="font-mono text-xs">{row.pr.headSha.slice(0, 7)}</span>?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className={cn('min-h-11', VURDER_FOCUS_RING)}
                            disabled={isPending}
                            onClick={() =>
                              runMerge(
                                mergeKey,
                                'DenckerStudio',
                                'Folkets-meninger',
                                row.pr!.number,
                                row.pr!.headSha,
                              )
                            }
                          >
                            {pendingMergingKey === mergeKey ? 'Merger …' : 'Bekreft merge'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn('min-h-11', VURDER_FOCUS_RING)}
                            onClick={() => setMergeConfirmKey(null)}
                          >
                            Avbryt
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {failedRows.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Feilet</h3>
            {failedRows.map((row) => {
              const errKey = `feilet-${row.taskId}`;
              const busy = pendingTaskId === row.taskId;
              const confirming = failedRejectConfirmId === row.taskId;
              return (
                <article
                  key={row.taskId}
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
                >
                  <h4 className="text-sm font-semibold text-foreground">{row.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Vikunja #{row.taskId}</p>
                  {row.failureComment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{row.failureComment}</p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Ingen feilmelding i kommentarer.</p>
                  )}
                  {row.pr ? (
                    <Link
                      href={row.pr.url}
                      className={cn(
                        'mt-2 inline-flex min-h-11 items-center text-sm text-brand hover:underline',
                        VURDER_FOCUS_RING,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Se pull request
                    </Link>
                  ) : null}
                  {cardErrors[errKey] ? (
                    <p className="mt-2 text-xs text-destructive" role="alert">
                      {cardErrors[errKey]}
                    </p>
                  ) : null}
                  {!confirming ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={cn('min-h-11', VURDER_FOCUS_RING)}
                        disabled={busy || isPending}
                        onClick={() => runRequeueFailed(row.taskId)}
                      >
                        {busy && pendingTaskId === row.taskId ? 'Legger i kø …' : 'Sett i kø igjen'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('min-h-11', VURDER_FOCUS_RING)}
                        disabled={busy || isPending}
                        onClick={() => setFailedRejectConfirmId(row.taskId)}
                      >
                        Avvis
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3"
                      role="region"
                      aria-label="Bekreft avvisning av feilet oppgave"
                    >
                      <p className="text-sm font-medium text-foreground">
                        Avvis feilet oppgave og marker som ferdig?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          className={cn('min-h-11', VURDER_FOCUS_RING)}
                          disabled={busy || isPending}
                          onClick={() => runRejectFailed(row.taskId)}
                        >
                          {busy ? 'Avviser …' : 'Bekreft avvisning'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('min-h-11', VURDER_FOCUS_RING)}
                          onClick={() => setFailedRejectConfirmId(null)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {hubNotice ? (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between',
            hubNotice.variant === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-amber-500/30 bg-amber-500/10',
          )}
          role="status"
          aria-live="polite"
          aria-labelledby="lokal-ai-hub-notice-text"
        >
          <div className="flex gap-2">
            {hubNotice.variant === 'warning' ? (
              <TriangleAlert
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-800 dark:text-amber-200"
                aria-hidden
              />
            ) : (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                aria-hidden
              />
            )}
            <p id="lokal-ai-hub-notice-text" className="text-sm text-foreground">
              {hubNotice.variant === 'warning' ? (
                <>
                  <span className="font-semibold">Advarsel:</span> {hubNotice.body}
                </>
              ) : (
                hubNotice.body
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {hubNotice.pullUrl && hubNotice.pullNumber ? (
              <Link
                href={hubNotice.pullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'min-h-11 gap-1.5',
                  VURDER_FOCUS_RING,
                )}
              >
                Åpne PR #{hubNotice.pullNumber} på GitHub
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
            {hubNotice.canRetryReady ? (
              <Button
                type="button"
                variant="secondary"
                className={cn('min-h-11', VURDER_FOCUS_RING)}
                disabled={retryReadyTaskId === hubNotice.taskId || isPending}
                onClick={() => runRetryReady(hubNotice.taskId)}
              >
                {retryReadyTaskId === hubNotice.taskId
                  ? 'Prøver …'
                  : 'Prøv igjen å sette ready'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className={cn('min-h-11', VURDER_FOCUS_RING)}
              onClick={dismissHubNotice}
            >
              Lukk
            </Button>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="lokal-ai-forslag-heading" className="space-y-4">
        <h2 id="lokal-ai-forslag-heading" className="text-lg font-semibold text-foreground">
          Forslag
        </h2>
        {overview.forslag.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen forslag venter på godkjenning.</p>
        ) : (
          <div className="grid gap-4">
            {overview.forslag.map((row) => {
              const busy = pendingTaskId === row.taskId;
              const confirming = rejectConfirmId === row.taskId;
              const errKey = `f-${row.taskId}`;
              return (
                <article
                  key={row.taskId}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <h3 className="text-sm font-semibold text-foreground">{row.title}</h3>
                  {row.description ? (
                    <p className="mt-2 line-clamp-6 text-sm text-muted-foreground">{row.description}</p>
                  ) : null}
                  {cardErrors[errKey] ? (
                    <p className="mt-2 text-xs text-destructive" role="alert">
                      {cardErrors[errKey]}
                    </p>
                  ) : null}
                  {!confirming ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={cn('min-h-11', VURDER_FOCUS_RING)}
                        disabled={busy || isPending}
                        onClick={() => runApprove(row.taskId)}
                      >
                        {busy ? 'Godkjenner …' : 'Godkjenn'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('min-h-11', VURDER_FOCUS_RING)}
                        disabled={busy || isPending}
                        onClick={() => setRejectConfirmId(row.taskId)}
                      >
                        Avvis
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3"
                      role="region"
                      aria-label="Bekreft avvisning"
                    >
                      <p className="text-sm font-medium text-foreground">Avvis forslaget og marker som ferdig?</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          className={cn('min-h-11', VURDER_FOCUS_RING)}
                          disabled={busy || isPending}
                          onClick={() => runReject(row.taskId)}
                        >
                          Bekreft avvisning
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn('min-h-11', VURDER_FOCUS_RING)}
                          onClick={() => setRejectConfirmId(null)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}