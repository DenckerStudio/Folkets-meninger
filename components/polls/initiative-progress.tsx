'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { routes } from '@/lib/routes';
import type { CitizenInitiativeRecord } from '@/lib/polls/types';
import { cn } from '@/lib/utils';

type InitiativeProgressProps = {
  initiative: CitizenInitiativeRecord;
  initiallyEndorsed?: boolean;
  showActions?: boolean;
};

export default function InitiativeProgress({
  initiative,
  initiallyEndorsed = false,
  showActions = true,
}: InitiativeProgressProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [supportCount, setSupportCount] = useState(initiative.supportCount);
  const [status, setStatus] = useState(initiative.status);
  const [promotedPollId, setPromotedPollId] = useState(initiative.promotedPollId);
  const [endorsed, setEndorsed] = useState(initiallyEndorsed);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const threshold = Math.max(initiative.supportThreshold, 1);
  const pct = Math.min(100, Math.round((supportCount / threshold) * 100));
  const thresholdMet = status === 'threshold_met' || supportCount >= threshold;
  const promoted = status === 'promoted' && promotedPollId;

  const endorse = async () => {
    if (!user) {
      router.push(routes.login);
      return;
    }
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
      setEndorsed(true);
      if (typeof data.supportCount === 'number') setSupportCount(data.supportCount);
      if (typeof data.status === 'string') setStatus(data.status);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  const promote = async () => {
    if (!user) {
      router.push(routes.login);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'promote', initiativeId: initiative.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kunne ikke oppgradere til avstemning');
        return;
      }
      setStatus('promoted');
      setPromotedPollId(data.pollId);
      router.push(routes.poll(data.pollId));
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Borgerinitiativ</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            <Link href={routes.initiative(initiative.id)} className="hover:underline">
              {initiative.title}
            </Link>
          </h3>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600">{initiative.body}</p>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-gray-600">
          <span>
            {supportCount} av {threshold} støtteerklæringer
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn('h-full rounded-full transition-all', thresholdMet ? 'bg-emerald-500' : 'bg-[#00205b]')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {showActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={routes.forumTopic(initiative.forumThreadId)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Diskuter i forum
          </Link>
          {promoted ? (
            <Link
              href={routes.poll(promotedPollId)}
              className="rounded-lg bg-[#00205b] px-3 py-2 text-sm font-medium text-white hover:bg-[#001a4a]"
            >
              Gå til avstemning
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={endorse}
                disabled={busy || endorsed || status === 'rejected' || status === 'withdrawn'}
                className="rounded-lg border border-[#00205b]/20 bg-[#00205b]/5 px-3 py-2 text-sm font-medium text-[#00205b] hover:bg-[#00205b]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {endorsed ? 'Du støtter dette' : 'Støtt initiativet'}
              </button>
              {thresholdMet ? (
                <button
                  type="button"
                  onClick={promote}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Oppgrader til nasjonal avstemning
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}

function StatusBadge({ status }: { status: CitizenInitiativeRecord['status'] }) {
  const label =
    status === 'gathering'
      ? 'Samler støtte'
      : status === 'threshold_met'
        ? 'Terskel nådd'
        : status === 'promoted'
          ? 'Oppgradert'
          : status === 'rejected'
            ? 'Avvist'
            : 'Trukket';

  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 text-xs font-semibold',
        status === 'gathering' && 'bg-sky-50 text-sky-800',
        status === 'threshold_met' && 'bg-amber-50 text-amber-800',
        status === 'promoted' && 'bg-emerald-50 text-emerald-800',
        (status === 'rejected' || status === 'withdrawn') && 'bg-gray-100 text-gray-600',
      )}
    >
      {label}
    </span>
  );
}
