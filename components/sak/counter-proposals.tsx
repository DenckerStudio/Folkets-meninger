'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileSignature, Loader2, Scale } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import {
  COUNTER_PROPOSAL_BODY_MIN,
  COUNTER_PROPOSAL_DEFAULT_THRESHOLD,
  COUNTER_PROPOSAL_TITLE_MIN,
  type CounterProposalHearingLink,
  type CounterProposalRecord,
} from '@/lib/counter-proposals/types';

function statusLabel(status: CounterProposalRecord['status']): string {
  switch (status) {
    case 'gathering':
      return 'Samler støtte';
    case 'threshold_met':
      return 'Terskel nådd';
    case 'packaged':
      return 'Pakket som innspill';
    case 'withdrawn':
      return 'Trukket';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function CounterProposals({ sakId }: { sakId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [proposals, setProposals] = useState<CounterProposalRecord[]>([]);
  const [hearing, setHearing] = useState<CounterProposalHearingLink | null>(null);
  const [endorsedIds, setEndorsedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [endorsingId, setEndorsingId] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch(`/api/sak/${sakId}/counter-proposals`, { cache: 'no-store' });
    const json = await res.json();
    if (Array.isArray(json.proposals)) setProposals(json.proposals);
    setHearing(json.hearing ?? null);
    setEndorsedIds(Array.isArray(json.endorsedIds) ? json.endorsedIds : []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setError('Kunne ikke laste motforslag.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // sakId is the only input; refresh closes over the current id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sakId]);

  const create = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.sak(sakId))}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/sak/${sakId}/counter-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title, body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Kunne ikke opprette motforslag');
        return;
      }
      setTitle('');
      setBody('');
      await refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  const endorse = async (proposalId: string) => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.sak(sakId))}`);
      return;
    }
    setEndorsingId(proposalId);
    setError('');
    try {
      const res = await fetch(`/api/sak/${sakId}/counter-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'endorse', proposalId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Kunne ikke støtte motforslaget');
        return;
      }
      await refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setEndorsingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Motforslag</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Foreslå et alternativ til Stortingets sak. Ved {COUNTER_PROPOSAL_DEFAULT_THRESHOLD}{' '}
            støtteerklæringer pakker vi en strukturert rapport som kan sendes som innspill til
            fagkomiteen. Dette går ikke automatisk inn i et Stortinget-API — n8n/e-post og
            stortinget.no er den offisielle veien.
          </p>
        </div>
      </div>

      {hearing ? (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">
            {hearing.open ? 'Åpen høring knyttet til saken' : 'Tilknyttet høring'}
          </p>
          <p className="mt-1 text-muted-foreground">
            {hearing.title}
            {hearing.komite ? ` · ${hearing.komite}` : ''}
            {hearing.deadlineLabel ? ` · ${hearing.deadlineLabel}` : ''}
          </p>
          <Link
            href={routes.horing(hearing.id)}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <FileSignature className="h-3.5 w-3.5" />
            Åpne høringen
          </Link>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Ingen åpen Stortinget-høring er knyttet til saken akkurat nå. Motforslag kan likevel
          samle støtte og pakkes som rapport.
        </p>
      )}

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster motforslag …
        </div>
      ) : proposals.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Ingen motforslag ennå.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {proposals.map((proposal) => {
            const endorsed = endorsedIds.includes(proposal.id);
            return (
              <li key={proposal.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{proposal.title}</h3>
                  <span className="text-xs font-medium text-muted-foreground">
                    {statusLabel(proposal.status)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{proposal.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {proposal.authorName ? `${proposal.authorName} · ` : ''}
                  {proposal.supportCount} av {proposal.supportThreshold} støtter
                </p>
                <button
                  type="button"
                  onClick={() => endorse(proposal.id)}
                  disabled={endorsed || endorsingId === proposal.id || proposal.status === 'packaged'}
                  className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {endorsed
                    ? 'Du støtter dette'
                    : endorsingId === proposal.id
                      ? 'Lagrer …'
                      : 'Støtt motforslaget'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 space-y-3 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground">Frem et motforslag</h3>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Kort tittel på alternativet"
          maxLength={200}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Begrunnelse (minst ${COUNTER_PROPOSAL_BODY_MIN} tegn). Forklar hva som bør gjøres annerledes.`}
          rows={5}
          maxLength={8000}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={create}
          disabled={
            busy ||
            title.trim().length < COUNTER_PROPOSAL_TITLE_MIN ||
            body.trim().length < COUNTER_PROPOSAL_BODY_MIN
          }
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Publiserer …' : user ? 'Publiser motforslag' : 'Logg inn for å foreslå'}
        </button>
      </div>
    </section>
  );
}
