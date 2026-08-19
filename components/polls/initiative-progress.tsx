'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { initiativeStatusLabel } from '@/lib/polls/labels';
import type { CitizenInitiativeRecord, InitiativeStatus } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

type InitiativeProgressProps = {
  initiative: CitizenInitiativeRecord;
  endorsed: boolean;
  canPromote: boolean;
};

export default function InitiativeProgress({
  initiative,
  endorsed: initialEndorsed,
  canPromote,
}: InitiativeProgressProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [supportCount, setSupportCount] = useState(initiative.supportCount);
  const [status, setStatus] = useState<InitiativeStatus>(initiative.status);
  const [endorsed, setEndorsed] = useState(initialEndorsed);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const percent = Math.min(100, Math.round((supportCount / Math.max(initiative.supportThreshold, 1)) * 100));
  const canEndorse = status === 'gathering' || status === 'threshold_met';

  const endorse = async () => {
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.initiative(initiative.id))}`);
      return;
    }
    if (endorsed || !canEndorse || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'endorse', initiativeId: initiative.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke støtte initiativet');
        return;
      }
      if (typeof data.supportCount === 'number') setSupportCount(data.supportCount);
      if (
        data.status === 'gathering' ||
        data.status === 'threshold_met' ||
        data.status === 'promoted' ||
        data.status === 'rejected' ||
        data.status === 'withdrawn'
      ) {
        setStatus(data.status);
      }
      setEndorsed(true);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  const promote = async (force: boolean) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote', initiativeId: initiative.id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke opprette avstemning');
        return;
      }
      if (typeof data.pollId === 'string') {
        router.push(routes.poll(data.pollId));
        router.refresh();
      }
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {initiativeStatusLabel(status)}
        </span>
      </div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">{initiative.title}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {supportCount} av {initiative.supportThreshold} støtteerklæringer
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canEndorse ? (
          <button
            type="button"
            onClick={endorse}
            disabled={busy || endorsed}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {endorsed ? 'Du støtter dette' : 'Støtt initiativet'}
          </button>
        ) : null}
        {initiative.promotedPollId ? (
          <a
            href={routes.poll(initiative.promotedPollId)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Gå til avstemning
          </a>
        ) : null}
        {canPromote && status === 'threshold_met' && !initiative.promotedPollId ? (
          <button
            type="button"
            onClick={() => promote(false)}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Opprett avstemning
          </button>
        ) : null}
        {canPromote && !initiative.promotedPollId ? (
          <button
            type="button"
            onClick={() => promote(true)}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Tving avstemning (admin)
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
