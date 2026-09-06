'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { pollDraftGenerationStatusLabel } from '@/lib/admin/poll-draft-generation';
import { usePollDraftGeneration } from '@/hooks/use-poll-draft-generation';
import { routes } from '@/lib/routes';
import type { PollRecord, SakPollCandidate, SakPollCoverage } from '@/lib/polls/types';

type DraftsResponse = { drafts: PollRecord[] };
type CandidatesResponse = { candidates: SakPollCandidate[]; coverage: SakPollCoverage };
type AdminsResponse = { admins: { userId: string; email: string | null }[] };
type SupportersResponse = {
  supporters: { userId: string; email: string | null; subscriptionStatus: string | null }[];
};

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

export default function AdminReelsClient() {
  const [drafts, setDrafts] = useState<PollRecord[]>([]);
  const [candidates, setCandidates] = useState<SakPollCandidate[]>([]);
  const [coverage, setCoverage] = useState<SakPollCoverage | null>(null);
  const [admins, setAdmins] = useState<{ userId: string; email: string | null }[]>([]);
  const [supporters, setSupporters] = useState<{ userId: string; email: string | null }[]>([]);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [stemmePlusEmail, setStemmePlusEmail] = useState('');
  const [pending, startTransition] = useTransition();
  const { jobs, startGeneration, dismissJob, getJob, isGenerating } = usePollDraftGeneration();

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const [draftsRes, candidatesRes, adminsRes, supportersRes] = await Promise.all([
          fetch('/api/admin/polls'),
          fetch('/api/admin/poll-candidates'),
          fetch('/api/admin/roles'),
          fetch('/api/admin/stemme-plus'),
        ]);
        if (!draftsRes.ok || !candidatesRes.ok || !adminsRes.ok || !supportersRes.ok) {
          setError('Kunne ikke laste admin-data');
          return;
        }
        const draftsJson = (await draftsRes.json()) as DraftsResponse;
        const candidatesJson = (await candidatesRes.json()) as CandidatesResponse;
        const adminsJson = (await adminsRes.json()) as AdminsResponse;
        const supportersJson = (await supportersRes.json()) as SupportersResponse;
        setDrafts(draftsJson.drafts ?? []);
        setCandidates(candidatesJson.candidates ?? []);
        setCoverage(candidatesJson.coverage ?? null);
        setAdmins(adminsJson.admins ?? []);
        setSupporters(
          (supportersJson.supporters ?? []).map((row) => ({
            userId: row.userId,
            email: row.email,
          })),
        );
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

  const patchPoll = (id: string, action: 'publish' | 'archive') => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : 'Handling feilet');
        return;
      }
      load();
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

  const grantAdmin = () => {
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke gi admin-rolle');
        return;
      }
      setEmail('');
      load();
    });
  };

  const revokeAdmin = (adminEmail: string) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke fjerne admin-rolle');
        return;
      }
      load();
    });
  };

  const grantStemmePlus = () => {
    const value = stemmePlusEmail.trim();
    if (!value) return;
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke gi Stemme+');
        return;
      }
      setStemmePlusEmail('');
      load();
    });
  };

  const revokeStemmePlus = (supporterEmail: string) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supporterEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke fjerne Stemme+');
        return;
      }
      load();
    });
  };

  const activeGeneratingJobs = jobs.filter((job) => job.status === 'generating');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Sparkles className="h-6 w-6 text-brand" />
          Reels-utkast
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Systemgenererte ja/nei/blank-spørsmål fra stortingssaker. Publiser til Reels-feeden, eller arkiver.
        </p>
      </div>

      {coverage ? (
        <p className="text-sm text-muted-foreground">
          {coverage.sakCandidates} kandidater · {coverage.pendingWithRag} saker med RAG · {drafts.length} utkast
        </p>
      ) : null}

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
                ? 'Genererer utkast via n8n…'
                : `Genererer ${activeGeneratingJobs.length} utkast via n8n…`}
            </p>
            <p className="text-muted-foreground">
              Vi sjekker utkastlisten automatisk. Dette kan ta opptil et minutt.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Ingen utkast. Generer fra en sak under, eller vent på n8n-kjøringen.
          </p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((poll) => (
              <li key={poll.id} className="rounded-2xl border border-border bg-card p-4">
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patchPoll(poll.id, 'publish')}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Publiser
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patchPoll(poll.id, 'archive')}
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
          <p className="text-sm text-muted-foreground">Ingen kandidater med klare RAG-chunks akkurat nå.</p>
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
                    {candidate.issueId} · {candidate.ragChunkCount} RAG-chunks
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

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Stemme+ (testing)</h2>
        <p className="text-sm text-muted-foreground">
          Gi eller fjern støttemedlemskap manuelt. Stripe-betaling kommer senere.
        </p>
        <ul className="space-y-2">
          {supporters.map((supporter) => (
            <li
              key={supporter.userId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{supporter.email || supporter.userId}</span>
              {supporter.email ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => revokeStemmePlus(supporter.email as string)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Fjern
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {supporters.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen aktive Stemme+-støttespillere.</p>
        ) : null}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            grantStemmePlus();
          }}
        >
          <input
            type="email"
            value={stemmePlusEmail}
            onChange={(event) => setStemmePlusEmail(event.target.value)}
            placeholder="epost@domene.no"
            className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={pending || !stemmePlusEmail.trim()}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Gi Stemme+
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Administratorer</h2>
        <p className="text-sm text-muted-foreground">
          Roller lagres i databasen, ikke i miljøvariabler.
        </p>
        <ul className="space-y-2">
          {admins.map((admin) => (
            <li
              key={admin.userId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground">{admin.email || admin.userId}</span>
              {admin.email ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => revokeAdmin(admin.email as string)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Fjern
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            grantAdmin();
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="epost@domene.no"
            className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Gi admin
          </button>
        </form>
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={routes.adminStats} className="font-medium text-brand hover:underline">
          Statistikk
        </Link>
        <Link href={routes.avstemningerReels} className="font-medium text-brand hover:underline">
          Offentlig Reels-feed
        </Link>
      </div>
    </div>
  );
}
