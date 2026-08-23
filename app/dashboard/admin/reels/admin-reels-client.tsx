'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { routes } from '@/lib/routes';
import type { PollRecord, SakPollCandidate, SakPollCoverage } from '@/lib/polls/types';

type DraftsResponse = { drafts: PollRecord[] };
type CandidatesResponse = { candidates: SakPollCandidate[]; coverage: SakPollCoverage };
type AdminsResponse = { admins: { userId: string; email: string | null }[] };

export default function AdminReelsClient() {
  const [drafts, setDrafts] = useState<PollRecord[]>([]);
  const [candidates, setCandidates] = useState<SakPollCandidate[]>([]);
  const [coverage, setCoverage] = useState<SakPollCoverage | null>(null);
  const [admins, setAdmins] = useState<{ userId: string; email: string | null }[]>([]);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const [draftsRes, candidatesRes, adminsRes] = await Promise.all([
          fetch('/api/admin/polls'),
          fetch('/api/admin/poll-candidates'),
          fetch('/api/admin/roles'),
        ]);
        if (!draftsRes.ok || !candidatesRes.ok || !adminsRes.ok) {
          setError('Kunne ikke laste admin-data');
          return;
        }
        const draftsJson = (await draftsRes.json()) as DraftsResponse;
        const candidatesJson = (await candidatesRes.json()) as CandidatesResponse;
        const adminsJson = (await adminsRes.json()) as AdminsResponse;
        setDrafts(draftsJson.drafts ?? []);
        setCandidates(candidatesJson.candidates ?? []);
        setCoverage(candidatesJson.coverage ?? null);
        setAdmins(adminsJson.admins ?? []);
      } catch {
        setError('Kunne ikke laste admin-data');
      }
    });
  };

  useEffect(() => {
    load();
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
      const res = await fetch('/api/admin/poll-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(issueId ? { stortinget_issue_id: issueId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke starte generering');
        return;
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Utkast</h2>
          <button
            type="button"
            onClick={() => generate()}
            disabled={pending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            Generer neste
          </button>
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => generate(candidate.issueId)}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Generer utkast
                </button>
              </li>
            ))}
          </ul>
        )}
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
