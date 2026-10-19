'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { isPollVotingOpen } from '@/lib/polls/format';
import type { PollChoice, PollTotals, SystemReelFeedItem } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

export function useReelVote(item: SystemReelFeedItem) {
  const { user } = useAuth();
  const router = useRouter();
  const [totals, setTotals] = useState(item.totals);
  const [userVote, setUserVote] = useState<PollChoice | null>(item.userVote);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const votingOpen = isPollVotingOpen(item.poll);

  const voteDisabled = busy || Boolean(userVote) || !votingOpen;

  const vote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || busy) return false;
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(routes.utforskReels(item.poll.id))}`);
      return false;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: item.poll.id, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke registrere stemme');
        return false;
      }
      if (data.totals) setTotals(data.totals as PollTotals);
      setUserVote(choice);
      return true;
    } catch {
      setError('En feil oppstod');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    user,
    totals,
    userVote,
    error,
    busy,
    votingOpen,
    voteDisabled,
    vote,
  };
}
