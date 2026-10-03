'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { isPollVotingOpen } from '@/lib/polls/format';
import { POLL_BALLOT_CHOICES, pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals, SystemReelFeedItem } from '@/lib/polls/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SLIDE = { type: 'spring', stiffness: 90, damping: 18 } as const;

function reelChoiceClassName(choice: PollChoice): string {
  switch (choice) {
    case 'ja':
      return 'bg-brand-accent text-white hover:bg-brand-accent/90';
    case 'nei':
      return 'bg-background text-brand hover:bg-background/90';
    case 'blank':
      return 'bg-muted text-foreground hover:bg-muted/80';
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

function reelTotalsSummary(totals: PollTotals): string {
  return `${totals.ja} ja · ${totals.nei} nei · ${totals.blank} blank.`;
}

type ReelFlagVoteProps = {
  item: SystemReelFeedItem;
  onBack: () => void;
};

export function ReelFlagVote({ item, onBack }: ReelFlagVoteProps) {
  const { user } = useAuth();
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [totals, setTotals] = useState(item.totals);
  const [userVote, setUserVote] = useState<PollChoice | null>(item.userVote);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const votingOpen = isPollVotingOpen(item.poll);

  const vote = async (choice: PollChoice) => {
    if (!votingOpen || userVote || busy) return;
    if (!user) {
      router.push(`${routes.login}?next=${encodeURIComponent(`${routes.utforsk}#reels`)}`);
      return;
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

  const voteDisabled = busy || Boolean(userVote) || !votingOpen;

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Hva mener du?</p>
        <h3 className="text-lg font-semibold leading-snug text-white sm:text-xl">{item.poll.title}</h3>
      </div>

      <div>
        {!votingOpen ? (
          <p className="mb-3 text-sm text-white/80">Avstemningen er stengt.</p>
        ) : userVote ? (
          <p className="mb-3 text-sm text-white/90">
            Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (anonymt).
            {totals.total > 0 ? ` ${reelTotalsSummary(totals)}` : ''}
          </p>
        ) : !user ? (
          <p className="mb-3 text-sm text-white/80">Logg inn for å avgi stemme.</p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-red-200">{error}</p> : null}

        <div className="overflow-hidden rounded-2xl shadow-lg">
          <AnimatePresence>
            {POLL_BALLOT_CHOICES.map((choice, index) => (
              <motion.button
                key={choice}
                type="button"
                custom={index}
                initial={reducedMotion ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...SLIDE,
                  delay: reducedMotion ? 0 : 0.05 + index * 0.07,
                }}
                disabled={voteDisabled}
                onClick={() => void vote(choice)}
                className={cn(
                  'flex w-full items-center justify-center px-4 py-3.5 text-base font-bold tracking-wide transition-opacity disabled:opacity-60',
                  reelChoiceClassName(choice),
                  userVote === choice ? 'ring-2 ring-inset ring-white/80' : '',
                )}
              >
                {pollChoiceLabel(choice)}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          Tilbake
        </button>
      </div>
    </div>
  );
}

export function ReelCarouselCard({
  item,
  selected,
  onSelect,
  onBack,
}: {
  item: SystemReelFeedItem;
  selected: boolean;
  onSelect: () => void;
  onBack: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const pointerStart = useRef({ x: 0, y: 0 });

  return (
    <div className="h-[22rem] w-[17.5rem] overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <motion.div
        className="flex h-full w-[200%]"
        animate={{ x: selected ? '-50%' : '0%' }}
        transition={reducedMotion ? { duration: 0 } : SLIDE}
      >
        <button
          type="button"
          onPointerDown={(event) => {
            pointerStart.current = { x: event.clientX, y: event.clientY };
          }}
          onClick={(event) => {
            const dx = Math.abs(event.clientX - pointerStart.current.x);
            const dy = Math.abs(event.clientY - pointerStart.current.y);
            if (dx > 10 || dy > 10) return;
            onSelect();
          }}
          className="flex h-full w-1/2 flex-col justify-between bg-gradient-to-b from-brand to-brand/80 p-5 text-left text-white"
        >
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
            <Sparkles className="h-3 w-3" aria-hidden />
            Reels
          </span>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold leading-snug sm:text-xl">{item.poll.title}</h3>
            {item.poll.neutralSummary ? (
              <p className="line-clamp-4 text-sm leading-relaxed text-white/80">{item.poll.neutralSummary}</p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-white/70">Trykk for å stemme</p>
        </button>
        <div className="h-full w-1/2 bg-brand p-5">
          <ReelFlagVote key={item.poll.id} item={item} onBack={onBack} />
        </div>
      </motion.div>
    </div>
  );
}
