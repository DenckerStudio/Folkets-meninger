'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
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

const DESCRIPTION_FADE = 'linear-gradient(to bottom, black calc(100% - 2.25rem), transparent)';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Reports whether a scroll container has more content than it can show. */
function useOverflow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, overflowing };
}

function reelChoiceClassName(choice: PollChoice): string {
  switch (choice) {
    case 'nei':
      return 'bg-[#ba0c2f] text-white hover:bg-[#ba0c2f]/90';
    case 'blank':
      return 'bg-white text-[#00205b] hover:bg-white/90';
    case 'ja':
      // Navy on navy needs a light edge so Ja stays readable on the vote face.
      return 'bg-[#0a3d9e] text-white ring-1 ring-inset ring-white/45 hover:bg-[#0c4ab8]';
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
  const { ref: descriptionRef, overflowing } = useOverflow<HTMLDivElement>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const mounted = useIsMounted();

  // Handle Escape key when "Les mer" sheet is open - capture phase to intercept before others
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [sheetOpen]);

  return (
    <div data-testid="reel-vote-face" className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex min-h-0 flex-col gap-1.5">
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-white/70">
          Hva mener du?
        </p>
        <h3 className="shrink-0 text-base font-semibold leading-snug text-white sm:text-lg">
          {item.poll.title}
        </h3>
        {item.poll.neutralSummary ? (
          <div
            ref={descriptionRef}
            data-testid="reel-description"
            className="min-h-0 overflow-y-auto overscroll-contain"
            style={
              overflowing
                ? { maskImage: DESCRIPTION_FADE, WebkitMaskImage: DESCRIPTION_FADE }
                : undefined
            }
          >
            <p className="pr-1 text-sm leading-relaxed text-white/80">{item.poll.neutralSummary}</p>
          </div>
        ) : null}
        {overflowing ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="shrink-0 self-start text-xs font-semibold text-white/90 underline decoration-white/40 underline-offset-2 transition-colors hover:text-white"
          >
            Les mer
          </button>
        ) : null}
      </div>

      <div className="shrink-0">
        {!votingOpen ? (
          <p className="mb-2 text-sm text-white/80">Avstemningen er stengt.</p>
        ) : userVote ? (
          <p className="mb-2 text-sm text-white/90">
            Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (anonymt).
            {totals.total > 0 ? ` ${reelTotalsSummary(totals)}` : ''}
          </p>
        ) : !user ? (
          <p className="mb-2 text-sm text-white/80">Logg inn for å avgi stemme.</p>
        ) : null}
        {error ? <p className="mb-2 text-sm text-red-200">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          <VoteFillButton
            selected={userVote === 'nei'}
            disabled={voteDisabled}
            onClick={() => void vote('nei')}
            className={cn(
              'flex items-center justify-center rounded-xl px-2 py-3.5 text-base font-bold tracking-wide transition-opacity disabled:opacity-60 sm:py-4 [@media(max-height:700px)]:py-2.5',
              reelChoiceClassName('nei'),
              userVote === 'nei' ? 'ring-2 ring-inset ring-white/80' : '',
            )}
          >
            {pollChoiceLabel('nei')}
          </VoteFillButton>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center rounded-xl border border-white/20 bg-white px-2 py-3.5 text-base font-bold tracking-wide text-[#00205b] transition-colors hover:bg-white/90 sm:py-4 [@media(max-height:700px)]:py-2.5"
          >
            Tilbake
          </button>

          <VoteFillButton
            selected={userVote === 'ja'}
            disabled={voteDisabled}
            onClick={() => void vote('ja')}
            className={cn(
              'flex items-center justify-center rounded-xl px-2 py-3.5 text-base font-bold tracking-wide transition-opacity disabled:opacity-60 sm:py-4 [@media(max-height:700px)]:py-2.5',
              reelChoiceClassName('ja'),
              userVote === 'ja' ? 'ring-2 ring-inset ring-white/80' : '',
            )}
          >
            {pollChoiceLabel('ja')}
          </VoteFillButton>
        </div>

        <div className="mt-2 flex justify-center">
          <button
            type="button"
            disabled={voteDisabled}
            onClick={() => void vote('blank')}
            aria-pressed={userVote === 'blank'}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-semibold underline decoration-white/40 underline-offset-2 transition-colors disabled:cursor-not-allowed',
              userVote === 'blank' ? 'text-white' : 'text-white/75 hover:text-white',
            )}
          >
            Stem blankt
          </button>
        </div>
      </div>

      {mounted && item.poll.neutralSummary
        ? createPortal(
            <AnimatePresence>
              {sheetOpen ? (
                <motion.div
                  key="reel-description-sheet"
                  className="fixed inset-0 z-[220] flex items-end justify-center"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
                >
                  <button
                    type="button"
                    aria-label="Lukk beskrivelsen"
                    onClick={() => setSheetOpen(false)}
                    className="absolute inset-0 bg-black/60"
                  />
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label={item.poll.title}
                    initial={reducedMotion ? false : { y: '100%' }}
                    animate={{ y: 0 }}
                    exit={reducedMotion ? { y: 0 } : { y: '100%' }}
                    transition={reducedMotion ? { duration: 0 } : SLIDE}
                    className="relative z-10 max-h-[80dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-[#00205b] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-white shadow-2xl"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold leading-snug sm:text-lg">
                        {item.poll.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSheetOpen(false)}
                        aria-label="Lukk"
                        className="shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">
                      {item.poll.neutralSummary}
                    </p>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
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
  mode = 'coverflow', // 'coverflow' | 'stories'
}: {
  item: SystemReelFeedItem;
  selected: boolean;
  onSelect: () => void;
  onBack: () => void;
  fill?: boolean;
  /** Hide when the stage header already shows Reels (avoids back covering badge). */
  showBadge?: boolean;
  /** Render mode: 'coverflow' uses absolute stacked faces; 'stories' uses CSS grid for content-driven height. */
  mode?: 'coverflow' | 'stories';
}) {
  const reducedMotion = usePrefersReducedMotion();
  const pointerStart = useRef({ x: 0, y: 0 });

  const isStories = mode === 'stories';

  if (isStories) {
    // Stories mode: content-driven height, single face with AnimatePresence transition.
    // Wrapper has max-h-full overflow-y-auto so vote buttons are always reachable on short viewports.
    return (
      <div className="max-h-full min-h-0 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
        {!selected ? (
          <motion.button
            key="front"
            type="button"
            onClick={onSelect}
            className={cn(
              'flex flex-col bg-gradient-to-b from-[#00205b] to-[#00205b]/80 p-5 text-left text-white',
              fill
                ? 'w-full rounded-none border-0'
                : 'w-full rounded-2xl border border-white/10',
            )}
            initial={reducedMotion ? false : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -30 }}
            transition={reducedMotion ? { duration: 0 } : SLIDE}
          >
            {showBadge ? (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                <CivicBubble className="h-3 w-3" />
                Reels
              </span>
            ) : (
              <span className="h-5" aria-hidden />
            )}
            <div className="space-y-2 flex-1 min-h-0 overflow-hidden">
              <h3 className="text-lg font-semibold leading-snug sm:text-xl">{item.poll.title}</h3>
              {item.poll.neutralSummary ? (
                <p className="line-clamp-3 text-sm leading-relaxed text-white/75">
                  {item.poll.neutralSummary}
                </p>
              ) : null}
            </div>
            <p className="text-xs font-medium text-white/70">Trykk for å stemme</p>
          </motion.button>
        ) : (
          <motion.div
            key="vote"
            className={cn(
              'flex flex-col bg-[#00205b] p-5 text-white',
              fill
                ? 'w-full rounded-none border-0'
                : 'w-full rounded-2xl border border-white/10',
            )}
            initial={reducedMotion ? false : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -30 }}
            transition={reducedMotion ? { duration: 0 } : SLIDE}
          >
            <ReelFlagVote item={item} onBack={onBack} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    );
  }

  // Coverflow mode: absolute stacked faces with flip animation
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-card shadow-sm',
        fill
          ? 'h-full w-full rounded-none border-0'
          : 'h-full w-full rounded-2xl border border-white/10',
      )}
    >
      {/*
        Absolute stacked faces (not a 200% strip). Coverflow applies overflow-hidden +
        rotateY on the outer card, which clipped the old horizontal slide so Ja/Nei/Blank
        stayed in the DOM but never became visible.
      */}
      <motion.div
        aria-hidden={selected}
        className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-[#00205b] to-[#00205b]/80 p-5 text-left text-white"
        initial={false}
        animate={{
          opacity: selected ? 0 : 1,
          x: selected ? (reducedMotion ? 0 : '-18%') : 0,
          pointerEvents: selected ? 'none' : 'auto',
        }}
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
          className="flex h-full w-full flex-col justify-between text-left"
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
      </motion.div>

      <motion.div
        aria-hidden={!selected}
        className="absolute inset-0 bg-[#00205b] p-5"
        initial={false}
        animate={{
          opacity: selected ? 1 : 0,
          x: selected ? 0 : reducedMotion ? 0 : '18%',
          pointerEvents: selected ? 'auto' : 'none',
        }}
        transition={reducedMotion ? { duration: 0 } : SLIDE}
      >
        <ReelFlagVote key={item.poll.id} item={item} onBack={onBack} />
      </motion.div>
    </div>
  );
}
