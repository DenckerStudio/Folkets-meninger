'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { pollChoicePercent } from '@/lib/polls/format';
import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals } from '@/lib/polls/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const CHOICES: PollChoice[] = ['ja', 'nei', 'blank'];

type PollBallotProps = {
  pollId: string;
  votingOpen: boolean;
  initialTotals: PollTotals;
  initialVote: PollChoice | null;
  loginNext?: string;
  compact?: boolean;
};

export function PollBallot({
  pollId,
  votingOpen,
  initialTotals,
  initialVote,
  loginNext,
  compact = false,
}: PollBallotProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [totals, setTotals] = useState(initialTotals);
  const [userVote, setUserVote] = useState<PollChoice | null>(initialVote);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const vote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || busy) return;
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(loginNext ?? routes.poll(pollId))}`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke registrere stemme');
        return;
      }
      if (data.totals) setTotals(data.totals);
      setUserVote(choice);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={cn(!compact && 'rounded-2xl border border-border bg-card p-5 shadow-sm')}>
      {compact ? null : (
        <>
          <h2 className="text-base font-semibold text-foreground">Hva mener du?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ja, nei eller blank. Stemmen lagres anonymt.
          </p>
        </>
      )}
      <div className={cn('grid gap-2 sm:grid-cols-3', compact ? 'mt-0' : 'mt-4')}>
        {CHOICES.map((choice) => {
          const selected = userVote === choice;
          return (
            <button
              key={choice}
              type="button"
              disabled={!votingOpen || Boolean(userVote) || busy}
              onClick={() => vote(choice)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-semibold transition-colors',
                selected
                  ? 'border-brand bg-brand text-white'
                  : 'border-border bg-background text-foreground hover:border-brand/40 hover:bg-brand/5',
                (!votingOpen || userVote) && !selected ? 'opacity-60' : '',
              )}
            >
              {pollChoiceLabel(choice)}
              <span className="mt-1 block text-xs font-normal opacity-80">
                {pollChoicePercent(totals, choice)}% · {totals[choice]}
              </span>
            </button>
          );
        })}
      </div>
      {!votingOpen ? (
        <p className="mt-3 text-sm text-muted-foreground">Avstemningen er stengt.</p>
      ) : userVote ? (
        <p className="mt-3 text-sm text-foreground">
          Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (anonymt i statistikken).
        </p>
      ) : !user ? (
        <p className="mt-3 text-sm text-muted-foreground">Logg inn for å avgi stemme.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
