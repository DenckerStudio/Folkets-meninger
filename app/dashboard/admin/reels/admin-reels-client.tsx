'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { CivicBubble } from '@/components/icons/civic';
import { pollDraftGenerationStatusLabel } from '@/lib/admin/poll-draft-generation';
import { usePollDraftGeneration } from '@/hooks/use-poll-draft-generation';
import { routes } from '@/lib/routes';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { ReelCandidateRatings } from '@/components/admin/reel-candidate-ratings';
import type { ContentFeedbackVerdict } from '@/lib/content-feedback/types';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { PollRecord, SakPollCandidate, SakPollCoverage } from '@/lib/polls/types';
import {
  aiSummaryQueueGaveUpKindLabel,
  pipelineHealthNeedsAttention,
  type AiSummaryQueueGaveUpItem,
  type PipelineHealth,
} from '@/lib/n8n/pipeline-health';

type DraftsResponse = { drafts: PollRecord[] };
type CandidatesResponse = { candidates: SakPollCandidate[]; coverage: SakPollCoverage };

function GenerationStatusBadge({
  issueId,
  getJob,
  onDismiss,
}: {
  issueId?: string;
  getJob: ReturnType<typeof usePollDraftGeneration>['getJob'];
  onDismiss: (key: string) => void;
}) {
  const job = getJob(issueId);
  if (!job || job.status === 'generating') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Genererer…
      </span>
    );
  }

  if (job.status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Utkast klart
        <button
          type="button"
          onClick={() => onDismiss(job.key)}
          className="rounded p-0.5 hover:bg-emerald-500/10"
          aria-label="Lukk status"
        >
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
      <AlertCircle className="h-3 w-3" aria-hidden />
      {pollDraftGenerationStatusLabel(job.status)}
      <button
        type="button"
        onClick={() => onDismiss(job.key)}
        className="rounded p-0.5 hover:bg-destructive/10"
        aria-label="Lukk status"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function AdminReelsClient({
  initialDrafts = [],
}: {
  initialDrafts?: PollRecord[];
}) {
  const searchParams = useSearchParams();
  const highlightPollId = searchParams.get('pollId')?.trim() ?? '';
  const highlightedRef = useRef(false);
  const [drafts, setDrafts] = useState<PollRecord[]>(initialDrafts);
  const [candidates, setCandidates] = useState<SakPollCandidate[]>([]);
  const [coverage, setCoverage] = useState<SakPollCoverage | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null);
  const [pipelineHealthError, setPipelineHealthError] = useState('');
  const [gaveUpQueue, setGaveUpQueue] = useState<AiSummaryQueueGaveUpItem[]>([]);
  const [gaveUpError, setGaveUpError] = useState('');
  const resetFocusRef = useRef<string | null>(null);
  const resetButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [resettingIssueId, setResettingIssueId] = useState<string | null>(null);
  const [catchupMessage, setCatchupMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [feedbackTarget, setFeedbackTarget] = useState<{
    pollId: string;
    verdict: ContentFeedbackVerdict;
    subjectTitle: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const { jobs, startGeneration, dismissJob, getJob, isGenerating } = usePollDraftGeneration();

  useEffect(() => {
    if (!highlightPollId || highlightedRef.current || drafts.length === 0) return;
    const el = document.getElementById(`reel-draft-${highlightPollId}`);
    if (!el) return;
    highlightedRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-brand');
  }, [drafts, highlightPollId]);

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const [draftsRes, candidatesRes, healthRes, gaveUpRes] = await Promise.all([
          fetch('/api/admin/polls'),
          fetch('/api/admin/poll-candidates'),
          fetch('/api/admin/pipeline-health'),
          fetch('/api/admin/ai-summary-queue'),
        ]);
        const failures: string[] = [];

        if (draftsRes.ok) {
          const draftsJson = (await draftsRes.json()) as DraftsResponse;
          setDrafts(draftsJson.drafts ?? []);
        } else {
          failures.push('utkast');
        }

        if (candidatesRes.ok) {
          const candidatesJson = (await candidatesRes.json()) as CandidatesResponse;
          setCandidates(candidatesJson.candidates ?? []);
          setCoverage(candidatesJson.coverage ?? null);
        } else {
          failures.push('sak-kandidater');
        }

        if (healthRes.ok) {
          const healthJson = (await healthRes.json()) as { health?: PipelineHealth };
          setPipelineHealth(healthJson.health ?? null);
          setPipelineHealthError('');
        } else {
          setPipelineHealth(null);
          const healthJson = (await healthRes.json().catch(() => ({}))) as { error?: string };
          setPipelineHealthError(
            typeof healthJson.error === 'string'
              ? healthJson.error
              : 'Kunne ikke hente pipeline-status',
          );
        }

        if (gaveUpRes.ok) {
          const gaveUpJson = (await gaveUpRes.json()) as {
            gaveUp?: Array<{
              issue_id: string;
              title: string | null;
              kind: AiSummaryQueueGaveUpItem['kind'];
              attempts: number;
              last_attempt_at: string | null;
            }>;
          };
          setGaveUpQueue(
            (gaveUpJson.gaveUp ?? []).map((row) => ({
              issueId: row.issue_id,
              title: row.title,
              kind: row.kind,
              attempts: row.attempts,
              lastAttemptAt: row.last_attempt_at,
            })),
          );
          setGaveUpError('');
        } else {
          const gaveUpJson = (await gaveUpRes.json().catch(() => ({}))) as { error?: string };
          setGaveUpError(
            typeof gaveUpJson.error === 'string'
              ? gaveUpJson.error
              : 'Kunne ikke hente kø for saker som har gitt opp',
          );
        }

        if (failures.length > 0) {
          setError(`Kunne ikke laste ${failures.join(', ')}`);
        }
      } catch {
        setError('Kunne ikke laste admin-data');
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onReady = () => load();
    window.addEventListener('poll-drafts:ready', onReady);
    return () => window.removeEventListener('poll-drafts:ready', onReady);
  }, []);

  const patchPoll = (poll: PollRecord, action: 'publish' | 'archive') => {
    startTransition(async () => {
      setError('');
      setSuccess('');
      const res = await fetch('/api/admin/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poll.id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Handling feilet');
        return;
      }
      setSuccess(action === 'publish' ? 'Utkastet er publisert.' : 'Utkastet er arkivert.');
      setFeedbackTarget({
        pollId: poll.id,
        verdict: action === 'publish' ? 'approve' : 'reject',
        subjectTitle: poll.title,
      });
      load();
    });
  };

  const resetQueueAttempts = (issueId: string) => {
    resetFocusRef.current = issueId;
    startTransition(async () => {
      setResettingIssueId(issueId);
      setError('');
      try {
        const res = await fetch('/api/admin/ai-summary-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: issueId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Kunne ikke nullstille forsøk');
          return;
        }
        setSuccess('Forsøk er nullstilt — saken kan tas på nytt.');
        load();
      } finally {
        setResettingIssueId(null);
        const focusId = resetFocusRef.current;
        if (focusId) {
          resetButtonRefs.current.get(focusId)?.focus();
          resetFocusRef.current = null;
        }
      }
    });
  };

  const runPipelineCatchup = () => {
    startTransition(async () => {
      setCatchupMessage('');
      setError('');
      const res = await fetch('/api/admin/pipeline-health', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke starte catch-up');
        return;
      }
      const triggered = data.triggered as { embeddings?: boolean; health?: boolean } | undefined;
      if (triggered?.embeddings || triggered?.health) {
        setCatchupMessage('Catch-up er startet. Køene oppdateres i bakgrunnen.');
      } else {
        setCatchupMessage('Automatisk oppfrisking er ikke tilgjengelig i dette miljøet.');
      }
    });
  };

  const generate = (issueId?: string) => {
    startTransition(async () => {
      setError('');
      try {
        await startGeneration(issueId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kunne ikke starte generering');
      }
    });
  };

  const activeGeneratingJobs = jobs.filter((job) => job.status === 'generating');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <CivicBubble className="h-6 w-6 text-brand" />
          Reels-utkast
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Publiser til Reels-feeden, eller arkiver.
        </p>
      </div>

      {coverage ? (
        <p className="text-sm text-muted-foreground">
          {coverage.sakCandidates} kandidater · {coverage.pendingWithRag} saker med dokumentindeks · {drafts.length}{' '}
          utkast
        </p>
      ) : null}

      <section
        className={`rounded-2xl border bg-card p-4 ${
          pipelineHealth && pipelineHealthNeedsAttention(pipelineHealth)
            ? 'border-amber-500/40'
            : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Bakgrunnsprosess</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pipelineHealth
                ? pipelineHealthNeedsAttention(pipelineHealth)
                  ? 'Køen er stor — kjør catch-up eller vent på daglig sjekk kl. 08:00.'
                  : 'Sync → dokumentindeks → sammendrag → Reels-utkast.'
                : 'Automatisk generering av sammendrag og utkast.'}
            </p>
          </div>
          <button
            type="button"
            onClick={runPipelineCatchup}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Kjør catch-up
          </button>
        </div>
        {pipelineHealthError ? (
          <p className="mt-3 text-sm text-destructive" role="status">
            {pipelineHealthError}
          </p>
        ) : null}
        {pipelineHealth ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Ventende dokumentindeks</dt>
              <dd className="font-medium text-foreground">{pipelineHealth.pendingChunks}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mangler sammendrag</dt>
              <dd className="font-medium text-foreground">{pipelineHealth.missingSummaries}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tynne sammendrag</dt>
              <dd className="font-medium text-foreground">{pipelineHealth.thinSummaries}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Utkast som venter</dt>
              <dd className="font-medium text-foreground">{pipelineHealth.draftPolls}</dd>
            </div>
          </dl>
        ) : null}
        {catchupMessage ? (
          <p className="mt-3 text-sm text-muted-foreground">{catchupMessage}</p>
        ) : null}
        {gaveUpError ? (
          <p className="mt-3 text-sm text-destructive" role="status">
            {gaveUpError}
          </p>
        ) : null}
        {gaveUpQueue.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Gitt opp ({gaveUpQueue.length})
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Fem mislykkede forsøk — nullstill for å ta saken på nytt.
            </p>
            <ul className="mt-3 space-y-2">
              {gaveUpQueue.map((row) => (
                <li
                  key={`${row.kind}-${row.issueId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {row.title ?? row.issueId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {aiSummaryQueueGaveUpKindLabel(row.kind)} · {row.attempts} forsøk ·{' '}
                      {row.issueId}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={routes.sak(row.issueId)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                    >
                      Åpne sak
                    </Link>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) resetButtonRefs.current.set(row.issueId, el);
                        else resetButtonRefs.current.delete(row.issueId);
                      }}
                      disabled={pending || resettingIssueId === row.issueId}
                      onClick={() => resetQueueAttempts(row.issueId)}
                      className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
                    >
                      {resettingIssueId === row.issueId ? 'Nullstiller…' : 'Nullstill'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {activeGeneratingJobs.length > 0 ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" aria-hidden />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              {activeGeneratingJobs.length === 1
                ? 'Genererer utkast i bakgrunnen…'
                : `Genererer ${activeGeneratingJobs.length} utkast i bakgrunnen…`}
            </p>
            <p className="text-muted-foreground">
              Vi sjekker utkastlisten automatisk. Dette kan ta opptil et minutt.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      ) : null}

      {feedbackTarget ? (
        <ContentFeedbackPanel
          key={feedbackTarget.pollId}
          contentType="reel"
          contentId={feedbackTarget.pollId}
          lockedVerdict={feedbackTarget.verdict}
          contentSubjectTitle={feedbackTarget.subjectTitle}
          title={
            feedbackTarget.verdict === 'reject'
              ? 'Hva kunne vært bedre?'
              : 'Hva fungerte bra?'
          }
          description={
            feedbackTarget.verdict === 'reject'
              ? 'Valgfritt — hjelper oss å unngå lignende utkast.'
              : 'Valgfritt — hjelper oss med neste generering.'
          }
          onSkip={() => setFeedbackTarget(null)}
          onSaved={() => setFeedbackTarget(null)}
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Utkast</h2>
          <div className="flex items-center gap-2">
            {getJob() ? <GenerationStatusBadge getJob={getJob} onDismiss={dismissJob} /> : null}
            <button
              type="button"
              onClick={() => generate()}
              disabled={pending || isGenerating()}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
            >
              Generer neste
            </button>
          </div>
        </div>
        {drafts.length === 0 ? (
          <EmptyState
            title="Ingen utkast"
            description="Generer fra en sak under, eller vent på automatisk kjøring. Listen er tom til et utkast er klart."
            className="py-8"
          />
        ) : (
          <ul className="space-y-3">
            {drafts.map((poll) => (
              <li
                key={poll.id}
                id={`reel-draft-${poll.id}`}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="font-medium text-foreground">{poll.title}</p>
                {poll.neutralSummary ? (
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{poll.neutralSummary}</p>
                ) : null}
                {poll.stortingetIssueId ? (
                  <Link
                    href={routes.sak(poll.stortingetIssueId)}
                    className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    Sak {poll.stortingetIssueId}
                  </Link>
                ) : null}
                <ReelCandidateRatings metadata={poll.generationMetadata} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patchPoll(poll, 'publish')}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Publiser
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patchPoll(poll, 'archive')}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                  >
                    Arkiver
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Sak-kandidater</h2>
        {candidates.length === 0 ? (
          <EmptyState
            title="Ingen sak-kandidater"
            description="Ingen kandidater med dokumentindeks, sammendrag eller sakssammendrag akkurat nå."
            className="py-6"
          />
        ) : (
          <ul className="space-y-2">
            {candidates.map((candidate) => (
              <li
                key={candidate.issueId}
                className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{candidate.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {candidate.issueId} · {candidate.ragChunkCount} dokumentutdrag
                    {candidate.hasAiSummary ? ' · Sammendrag' : ''}
                    {candidate.sourceKind === 'metadata' ? ' · kun metadata' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {getJob(candidate.issueId) ? (
                    <GenerationStatusBadge
                      issueId={candidate.issueId}
                      getJob={getJob}
                      onDismiss={dismissJob}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={pending || isGenerating(candidate.issueId)}
                      onClick={() => generate(candidate.issueId)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                    >
                      Generer utkast
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={routes.utforsk} className="font-medium text-brand hover:underline">
          Offentlig Reels-feed
        </Link>
        <AdminBackLink />
      </div>
    </div>
  );
}
