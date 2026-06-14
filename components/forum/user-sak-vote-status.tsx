'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Minus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

type VoteChoice = 'for' | 'against' | 'abstain';

const VOTE_DISPLAY: Record<
  VoteChoice,
  { label: string; icon: typeof ThumbsUp; className: string }
> = {
  for: {
    label: 'For',
    icon: ThumbsUp,
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  },
  against: {
    label: 'Mot',
    icon: ThumbsDown,
    className: 'bg-rose-50 text-rose-800 ring-rose-100',
  },
  abstain: {
    label: 'Avstår',
    icon: Minus,
    className: 'bg-gray-100 text-gray-700 ring-gray-200',
  },
};

function UserSakVoteStatusInner({ sakId }: { sakId: string }) {
  const [userVote, setUserVote] = useState<VoteChoice | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/vote?issueId=${encodeURIComponent(sakId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const vote = data.userVote;
        if (vote && ['for', 'against', 'abstain'].includes(vote)) {
          setUserVote(vote as VoteChoice);
        } else {
          setUserVote(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUserVote(null);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [sakId]);

  if (!loaded) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Henter stemme…
      </span>
    );
  }

  if (!userVote) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600/80 ring-1 ring-indigo-100/80">
        Du har ikke stemt på denne saken
      </span>
    );
  }

  const meta = VOTE_DISPLAY[userVote];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ring-1',
        meta.className
      )}
      title="Din stemme på denne saken"
    >
      <CheckCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Du stemte: {meta.label}
    </span>
  );
}

export default function UserSakVoteStatus({ sakId }: { sakId: string }) {
  const { user } = useAuth();
  if (!user) return null;
  return <UserSakVoteStatusInner key={sakId} sakId={sakId} />;
}
