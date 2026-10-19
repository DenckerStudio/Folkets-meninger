'use client';

import { useRef, type RefObject } from 'react';
import { useLineClampOverflow } from '@/hooks/use-line-clamp-overflow';
import Link from 'next/link';
import { motion } from 'motion/react';
import { CivicBubble } from '@/components/icons/civic';
import { VoteFillButton } from '@/components/motion/vote-fill';
import { ReelExpandedShell } from '@/components/polls/reel-expanded-shell';
import { useReelVote } from '@/components/polls/use-reel-vote';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useReelExpandMobile } from '@/hooks/use-reel-expand-mobile';
import { listReelPollSourceLinks } from '@/lib/polls/reel-source-links';
import { pollChoiceLabel } from '@/lib/polls/labels';
import type { PollChoice, SystemReelFeedItem } from '@/lib/polls/types';
import { REEL_TEXT_HIT } from '@/lib/polls/reel-tap-targets';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const SLIDE = { type: 'spring', stiffness: 90, damping: 18 } as const;

export function reelExpandLayoutId(pollId: string) {
  return `reel-expand-${pollId}`;
}

function reelChoiceClassName(choice: PollChoice): string {
  switch (choice) {
    case 'nei':
      return 'bg-[#ba0c2f] text-white hover:bg-[#ba0c2f]/90';
    case 'blank':
      return 'bg-white text-[#00205b] hover:bg-white/90';
    case 'ja':
      return 'bg-[#0a3d9e] text-white ring-1 ring-inset ring-white/45 hover:bg-[#0c4ab8]';
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

function reelTotalsSummary(totals: { ja: number; nei: number; blank: number; total: number }): string {
  return `${totals.ja} ja · ${totals.nei} nei · ${totals.blank} blank.`;
}

type ReelVoteState = ReturnType<typeof useReelVote>;

type ReelVoteFaceProps = {
  item: SystemReelFeedItem;
  onBack: () => void;
  mode: 'compact' | 'expanded';
  voteState: ReelVoteState;
  onRequestExpand?: () => void;
  onCollapseExpand?: () => void;
  lesMerRef?: RefObject<HTMLButtonElement | null>;
};

function ReelVoteFace({
  item,
  onBack,
  mode,
  voteState,
  onRequestExpand,
  onCollapseExpand,
  lesMerRef,
}: ReelVoteFaceProps) {
  const { user, totals, userVote, error, votingOpen, voteDisabled, vote } = voteState;
  const sourceLinks = listReelPollSourceLinks(item.poll);
  const isExpanded = mode === 'expanded';
  const { ref: descriptionClampRef, overflowing: descriptionClipped } = useLineClampOverflow<HTMLParagraphElement>();
  const showLesMer = Boolean(onRequestExpand && item.poll.neutralSummary && descriptionClipped);

  const handleContentActivate = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onRequestExpand || isExpanded) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    onRequestExpand();
  };

  const voteFooter = (
    <div
      className={cn(
        'shrink-0',
        isExpanded &&
          'border-t border-white/10 bg-[#00205b] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3',
        !isExpanded && 'max-sm:pr-10',
      )}
    >
        {!votingOpen ? (
          <p className="mb-2 text-sm text-white/80">Avstemningen er stengt.</p>
        ) : userVote ? (
          <p className="mb-2 text-sm text-white/90">
            Du har stemt {pollChoiceLabel(userVote).toLowerCase()} (anonymt).
            {totals.total > 0 ? ` ${reelTotalsSummary(totals)}` : ''}
          </p>
        ) : !user ? (
          <p className="mb-2 text-sm text-white/80">
            <Link
              href={`${routes.login}?next=${encodeURIComponent(routes.utforskReels(item.poll.id))}`}
              className="inline-flex min-h-11 items-center py-1 font-semibold text-white underline decoration-white/50 underline-offset-2 hover:decoration-white"
            >
              Logg inn for å avgi stemme
            </Link>
            .
          </p>
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
            onClick={() => (isExpanded ? onCollapseExpand?.() : onBack())}
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
              REEL_TEXT_HIT,
              'justify-center text-xs font-semibold underline decoration-white/40 underline-offset-2 transition-colors disabled:cursor-not-allowed',
              userVote === 'blank' ? 'text-white' : 'text-white/75 hover:text-white',
            )}
          >
            Stem blankt
          </button>
        </div>
    </div>
  );

  if (isExpanded) {
    return (
      <div data-testid="reel-vote-face" className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-2">
          <h3 className="text-lg font-semibold leading-snug text-white sm:text-xl">{item.poll.title}</h3>
          {item.poll.neutralSummary ? (
            <p
              data-testid="reel-description"
              className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/80"
            >
              {item.poll.neutralSummary}
            </p>
          ) : null}
          {sourceLinks.length > 0 ? (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Kilder</p>
              <ul className="space-y-1.5 text-sm">
                {sourceLinks.map((link) => (
                  <li key={link.id}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          REEL_TEXT_HIT,
                          'font-medium text-white underline decoration-white/40 underline-offset-2 hover:text-white/95',
                        )}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className={cn(
                          REEL_TEXT_HIT,
                          'font-medium text-white underline decoration-white/40 underline-offset-2 hover:text-white/95',
                        )}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {voteFooter}
      </div>
    );
  }

  return (
    <div
      data-testid="reel-vote-face"
      className="flex h-full min-h-0 flex-col gap-2"
      onClick={handleContentActivate}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-white/70">
          Hva mener du?
        </p>
        <h3 className="shrink-0 text-base font-semibold leading-snug text-white sm:text-lg">
          {item.poll.title}
        </h3>
        {item.poll.neutralSummary ? (
          <p
            ref={descriptionClampRef}
            data-testid="reel-description"
            className="line-clamp-4 text-sm leading-relaxed text-white/80"
          >
            {item.poll.neutralSummary}
          </p>
        ) : null}
        {showLesMer ? (
          <button
            ref={lesMerRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRequestExpand?.();
            }}
            className={cn(
              REEL_TEXT_HIT,
              'shrink-0 self-start text-xs font-semibold text-white/90 underline decoration-white/40 underline-offset-2 transition-colors hover:text-white',
            )}
          >
            Les mer
          </button>
        ) : null}
      </div>
      {voteFooter}
    </div>
  );
}

export function ReelCarouselCard({
  item,
  selected,
  isCentered,
  expanded,
  onSelect,
  onBack,
  onExpandedChange,
  fill = false,
  showBadge = true,
  mode = 'coverflow',
}: {
  item: SystemReelFeedItem;
  selected: boolean;
  isCentered: boolean;
  expanded: boolean;
  onSelect: () => void;
  onBack: () => void;
  onExpandedChange: (open: boolean) => void;
  fill?: boolean;
  showBadge?: boolean;
  mode?: 'coverflow' | 'stories';
}) {
  const reducedMotion = usePrefersReducedMotion();
  const isExpandMobile = useReelExpandMobile();
  const pointerStart = useRef({ x: 0, y: 0 });
  const lesMerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const canExpand = selected && isCentered;
  const useSharedLayout = canExpand && !isExpandMobile && !reducedMotion;
  const layoutId = reelExpandLayoutId(item.poll.id);
  const voteState = useReelVote(item);

  const requestExpand = () => {
    if (!canExpand) return;
    onExpandedChange(true);
  };

  const isStories = mode === 'stories';

  const voteShell = (
    <ReelVoteFace
      item={item}
      onBack={onBack}
      mode="compact"
      voteState={voteState}
      onRequestExpand={canExpand ? requestExpand : undefined}
      lesMerRef={lesMerRef}
    />
  );

  const expandedLayer = (
    <ReelExpandedShell
      open={expanded && canExpand}
      onClose={() => onExpandedChange(false)}
      layoutId={layoutId}
      title={item.poll.title}
      closeButtonRef={closeButtonRef}
      returnFocusRef={lesMerRef}
    >
      <ReelVoteFace
        item={item}
        onBack={onBack}
        mode="expanded"
        voteState={voteState}
        onCollapseExpand={() => onExpandedChange(false)}
      />
    </ReelExpandedShell>
  );

  if (isStories) {
    return (
      <div className="max-h-full min-h-0 overflow-y-auto overscroll-contain">
        {!selected ? (
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              'flex w-full flex-col bg-gradient-to-b from-[#00205b] to-[#00205b]/80 p-5 text-left text-white',
              fill ? 'rounded-none border-0' : 'rounded-2xl border border-white/10',
            )}
          >
            {showBadge ? (
              <span className="inline-flex items-center gap-1 self-start rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                <CivicBubble className="h-3 w-3" />
                Reels
              </span>
            ) : (
              <span className="h-5" aria-hidden />
            )}
            <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
              <h3 className="text-lg font-semibold leading-snug sm:text-xl">{item.poll.title}</h3>
              {item.poll.neutralSummary ? (
                <p className="line-clamp-3 text-sm leading-relaxed text-white/75">{item.poll.neutralSummary}</p>
              ) : null}
            </div>
            <p className="text-xs font-medium text-white/70">Trykk for å stemme</p>
          </button>
        ) : (
          <>
            {expanded && canExpand ? (
              <div className="h-full min-h-[12rem] w-full" aria-hidden />
            ) : (
              <motion.div
                layoutId={useSharedLayout ? layoutId : undefined}
                layout={useSharedLayout}
                className={cn(
                  'flex h-full min-h-0 flex-col bg-[#00205b] text-white',
                  fill ? 'rounded-none border-0' : 'rounded-2xl border border-white/10',
                )}
              >
                <div className="flex min-h-0 flex-1 flex-col p-5">{voteShell}</div>
              </motion.div>
            )}
            {expandedLayer}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-card shadow-sm',
        fill ? 'h-full w-full rounded-none border-0' : 'h-full w-full rounded-2xl border border-white/10',
      )}
    >
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
              <p className="line-clamp-3 text-sm leading-relaxed text-white/75">{item.poll.neutralSummary}</p>
            ) : null}
          </div>
          <p className="text-xs font-medium text-white/70">Trykk for å stemme</p>
        </button>
      </motion.div>

      <motion.div
        aria-hidden={!selected}
        className="absolute inset-0 bg-[#00205b]"
        initial={false}
        animate={{
          opacity: selected ? 1 : 0,
          x: selected ? 0 : reducedMotion ? 0 : '18%',
          pointerEvents: selected ? 'auto' : 'none',
        }}
        transition={reducedMotion ? { duration: 0 } : SLIDE}
      >
        {expanded && canExpand ? (
          <div className="h-full w-full" aria-hidden />
        ) : (
          <motion.div
            layoutId={useSharedLayout ? layoutId : undefined}
            layout={useSharedLayout}
            className="absolute inset-0 p-5"
          >
            {voteShell}
          </motion.div>
        )}
      </motion.div>
      {expandedLayer}
    </div>
  );
}
