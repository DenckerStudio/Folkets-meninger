'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CivicBubble } from '@/components/icons/civic';
import { VoteFillButton } from '@/components/motion/vote-fill';
import { useAuth } from '@/hooks/use-auth';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { isPollVotingOpen } from '@/lib/polls/format';
import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, PollTotals, SystemReelFeedItem } from '@/lib/polls/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SLIDE = { type: 'spring', stiffness: 90, damping: 18 } as const;

/** Flag order: Nei (red) → Blank (white) → Ja (navy). */
const REEL_FLAG_CHOICES: PollChoice[] = ['nei', 'blank', 'ja'];

function reelChoiceClassName(choice: PollChoice): string {
  switch (choice) {
    case 'nei':
      return 'bg-[#ba0c2f] text-white hover:bg-[#ba0c2f]/90';
    case 'blank':
      return 'bg-white text-[#00205b] hover:bg-white/90';
    case 'ja':
      return 'bg-[#00205b] text-white hover:bg-[#00205b]/90';
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
    <div className="flex h-full min-h-0 flex-col justify-between gap-3">
      <div className="min-h-0 space-y-2 overflow-y-auto">
        <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Hva mener du?</p>
        <h3 className="text-lg font-semibold leading-snug text-white sm:text-xl">{item.poll.title}</h3>
        {item.poll.neutralSummary ? (
          <p className="text-sm leading-relaxed text-white/80">{item.poll.neutralSummary}</p>
        ) : null}
      </div>

      <div className="shrink-0">
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
            {REEL_FLAG_CHOICES.map((choice, index) => (
              <motion.div
                key={choice}
                custom={index}
                initial={reducedMotion ? false : { opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...SLIDE,
                  delay: reducedMotion ? 0 : 0.05 + index * 0.07,
                }}
              >
                <VoteFillButton
                  selected={userVote === choice}
                  disabled={voteDisabled}
                  onClick={() => void vote(choice)}
                  className={cn(
                    'flex w-full items-center justify-center px-4 py-3.5 text-base font-bold tracking-wide transition-opacity disabled:opacity-60 sm:py-4',
                    reelChoiceClassName(choice),
                    userVote === choice ? 'ring-2 ring-inset ring-white/80' : '',
                  )}
                >
                  {pollChoiceLabel(choice)}
                </VoteFillButton>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#00205b] transition-colors hover:bg-white/90"
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
  fill = false,
  showBadge = true,
}: {
  item: SystemReelFeedItem;
  selected: boolean;
  onSelect: () => void;
  onBack: () => void;
  fill?: boolean;
  /** Hide when the stage header already shows Reels (avoids back covering badge). */
  showBadge?: boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const pointerStart = useRef({ x: 0, y: 0 });

  return (
    <div
      className={cn(
        'overflow-hidden bg-card shadow-sm',
        fill
          ? 'h-full w-full rounded-none border-0'
          : 'h-full w-full rounded-2xl border border-white/10',
      )}
    >
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
          className="flex h-full w-1/2 flex-col justify-between bg-gradient-to-b from-[#00205b] to-[#00205b]/80 p-5 text-left text-white"
        >
          {showBadge ? (
            <span className="inline-flex items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
              <CivicBubble className="h-3 w-3" />
              Reels
            </span>
          ) : (
            <span className="h-5" aria-hidden />
          )}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold leading-snug sm:text-xl">{item.poll.title}</h3>
            {item.poll.neutralSummary ? (
              <p className="line-clamp-3 text-sm leading-relaxed text-white/75">
                {item.poll.neutralSummary}
              </p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-white/70">Trykk for å stemme</p>
        </button>
        <div className="h-full w-1/2 bg-[#00205b] p-5">
          <ReelFlagVote key={item.poll.id} item={item} onBack={onBack} />
        </div>
      </motion.div>
    </div>
  );
}
