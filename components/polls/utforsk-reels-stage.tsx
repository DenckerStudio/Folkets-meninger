'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Compass, Info } from 'lucide-react';
import { CivicBubble } from '@/components/icons/civic';
import { EmptyLineState } from '@/components/motion/empty-line';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel';
import { Stories, StoriesContent, StoriesHeader, StoriesCounter, StoriesNavigationInline, Story } from '@/components/ui/stories-carousel';
import { ReelCarouselCard } from '@/components/polls/reel-vote-card';
import { ReelsExpandPortalProvider } from '@/components/polls/reels-expand-portal';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import type { SystemReelFeedItem } from '@/lib/polls/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MODAL_TRANSITION } from '@/lib/motion/tokens';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function subscribeLg(onStoreChange: () => void) {
  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getLg() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

/** Tablets (768–1023 px) get the stacked mobile layout, not a narrow coverflow. */
function useIsDesktopLg() {
  return useSyncExternalStore(subscribeLg, getLg, () => false);
}

function ReelsNavArrow({ direction }: { direction: 'forward' | 'back' }) {
  const iconClass = 'h-5 w-5';
  let icon: ReactNode;
  switch (direction) {
    case 'forward':
      icon = <ArrowRight className={iconClass} aria-hidden />;
      break;
    case 'back':
      icon = <ArrowLeft className={iconClass} aria-hidden />;
      break;
    default: {
      const _exhaustive: never = direction;
      icon = _exhaustive;
    }
  }

  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
      {icon}
    </span>
  );
}

type UtforskReelsStageProps = {
  items: SystemReelFeedItem[];
  children: (api: { openReels: () => void; itemCount: number }) => ReactNode;
};

export function UtforskReelsStage({ items, children }: UtforskReelsStageProps) {
  const reducedMotion = usePrefersReducedMotion();
  const mounted = useIsMounted();
  const pathname = usePathname();
  const reelsOpen = pathname === routes.utforskReels();
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [initialPollId, setInitialPollId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const openReels = useCallback(() => {
    window.history.pushState(null, '', routes.utforskReels());
  }, []);

  const closeReels = useCallback(() => {
    setActivePollId(null);
    if (pathname === routes.utforskReels()) {
      window.history.pushState(null, '', routes.utforsk);
    }
  }, [pathname]);

  // Legacy shim: redirect from #reels hash to the new route
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#reels') {
      const searchParams = new URLSearchParams(window.location.search);
      const poll = searchParams.get('poll') ?? undefined;
      window.history.replaceState(null, '', routes.utforskReels(poll));
    }
  }, []);

  // Initial selection: when the layer opens and ?poll=X is in the URL and X matches an item's poll.id, setActivePollId(X)
  useEffect(() => {
    if (!reelsOpen || initializedRef.current) return;
    const searchParams = new URLSearchParams(window.location.search);
    const pollId = searchParams.get('poll');
    if (pollId && items.some((item) => item.poll.id === pollId)) {
      // Centre the requested card (do not flip it into vote mode). Timeout avoids sync setState in effect.
      setTimeout(() => {
        setInitialPollId(pollId);
      }, 0);
    }
    initializedRef.current = true;
  }, [reelsOpen, items]);

  useEffect(() => {
    if (!reelsOpen) return;
    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    html.setAttribute('data-reels-open', '');
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.removeAttribute('data-reels-open');
      html.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [reelsOpen]);



  return (
    <div>
      <div aria-hidden={reelsOpen} {...(reelsOpen ? { inert: true } : {})}>
        {children({ openReels, itemCount: items.length })}
      </div>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {reelsOpen ? (
                <motion.div
                  key="reels-modal"
                  id="reels"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Reels"
                  className="fixed inset-0 z-[200] flex h-[100dvh] w-screen max-w-none flex-col bg-[#00205b]"
                  style={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : MODAL_TRANSITION}
                >
                  <ReelsPanel
                    active={reelsOpen}
                    items={items}
                    activePollId={activePollId}
                    initialPollId={initialPollId}
                    onSelect={setActivePollId}
                    onClose={closeReels}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ReelsEntryCta({
  onOpen,
  itemCount,
}: {
  onOpen: () => void;
  itemCount: number;
}) {
  return <ReelsNavCta direction="forward" itemCount={itemCount} onNavigate={onOpen} />;
}

export function ReelsBackCta({ onBack }: { onBack: () => void }) {
  return <ReelsNavCta direction="back" onNavigate={onBack} />;
}

type ReelsNavCopy = {
  badge: string;
  title: string;
  subtitle: string;
  BadgeIcon: typeof CivicBubble | typeof Compass;
};

function reelsNavCopy(direction: 'forward' | 'back', itemCount: number): ReelsNavCopy {
  switch (direction) {
    case 'forward':
      return {
        badge: 'Reels',
        title: 'Del din mening',
        subtitle:
          itemCount > 0
            ? 'Ja, nei eller blank på spørsmål fra stortingssaker.'
            : 'Ingen systemgenererte ja/nei/blank-Reels er publisert ennå.',
        BadgeIcon: CivicBubble,
      };
    case 'back':
      return {
        badge: 'Utforsk',
        title: 'Tilbake til saker',
        subtitle: 'Lovforslag og representantforslag.',
        BadgeIcon: Compass,
      };
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}

function ReelsNavCta({
  direction,
  itemCount = 0,
  onNavigate,
}: {
  direction: 'forward' | 'back';
  itemCount?: number;
  onNavigate: () => void;
}) {
  const reversed = direction === 'back';
  const { badge, title, subtitle, BadgeIcon } = reelsNavCopy(direction, itemCount);

  return (
    <button
      type="button"
      onClick={onNavigate}
      data-tour={direction === 'forward' ? 'reels' : undefined}
      aria-controls={direction === 'forward' ? 'reels' : undefined}
      aria-label={reversed ? 'Tilbake til saker' : 'Åpne Reels'}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 transition-[colors,transform] duration-200 hover:border-brand/40 hover:bg-brand/10 active:scale-[0.995]"
    >
      {reversed ? <ReelsNavArrow direction={direction} /> : null}

      <div className={cn('min-w-0 flex-1', reversed ? 'text-right' : 'text-left')}>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand',
            reversed && 'flex-row-reverse',
          )}
        >
          <BadgeIcon className="h-3.5 w-3.5" aria-hidden />
          {badge}
        </span>
        <h2 className="mt-1 text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {reversed ? null : <ReelsNavArrow direction={direction} />}
    </button>
  );
}

export function ReelsPanel({
  active,
  items,
  activePollId,
  initialPollId = null,
  onSelect,
  onClose,
}: {
  active: boolean;
  items: SystemReelFeedItem[];
  activePollId: string | null;
  initialPollId?: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktopLg();
  const reducedMotion = usePrefersReducedMotion();
  const cardOpen = Boolean(activePollId);
  const initialIndex = Math.max(
    0,
    initialPollId ? items.findIndex((item) => item.poll.id === initialPollId) : 0,
  );
  const [centeredIndex, setCenteredIndex] = useState(initialIndex);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [expandedPollId, setExpandedPollId] = useState<string | null>(null);
  const [expandPortalEl, setExpandPortalEl] = useState<HTMLDivElement | null>(null);
  const detailExpanded = active && expandedPollId !== null;

  const handleCenteredIndexChange = useCallback((index: number) => {
    setCenteredIndex(index);
    setExpandedPollId(null);
  }, []);

  const handlePollSelect = useCallback(
    (id: string | null) => {
      if (id !== activePollId) setExpandedPollId(null);
      onSelect(id);
    },
    [activePollId, onSelect],
  );

  const handleClose = useCallback(() => {
    setExpandedPollId(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (detailExpanded) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          return;
        }
      }

      // Escape closes panel or goes back
      if (event.key === 'Escape') {
        if (detailExpanded) {
          event.preventDefault();
          setExpandedPollId(null);
          return;
        }
        // Check if disclaimer is open - close only that
        if (disclaimerOpen) {
          event.preventDefault();
          setDisclaimerOpen(false);
          return;
        }
        // If card is flipped open, go back to front
        if (cardOpen) {
          event.preventDefault();
          handlePollSelect(null);
          return;
        }
        // Otherwise close Reels
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        const target = event.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
            return;
          }
        }
        event.preventDefault();
        // Don't trigger vote on space - follow existing desktop behavior (space not opening vote)
        return;
      }

      if (event.key === 'Enter') {
        if (cardOpen || detailExpanded || disclaimerOpen) return;
        const target = event.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
            return;
          }
          if (target.closest('button, a, [role="button"], [role="tab"]')) return;
        }
        const item = items[centeredIndex];
        if (!item) return;
        event.preventDefault();
        const id = item.poll.id;
        requestAnimationFrame(() => onSelect(id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    active,
    activePollId,
    cardOpen,
    centeredIndex,
    detailExpanded,
    disclaimerOpen,
    handleClose,
    handlePollSelect,
    items,
    onSelect,
  ]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {/* Header: back + REELS label so back never covers the card badge */}
      <div className="relative z-30 flex shrink-0 items-center gap-3 pb-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Tilbake til saker"
          className="inline-flex"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#00205b] shadow-sm">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </span>
          <span className="sr-only">Tilbake til saker</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white">
            <CivicBubble className="h-3.5 w-3.5" aria-hidden />
            Reels
          </p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => setDisclaimerOpen((value) => !value)}
            aria-expanded={disclaimerOpen}
            aria-controls="reels-disclaimer"
            aria-label={disclaimerOpen ? 'Skjul informasjon om Reels' : 'Vis informasjon om Reels'}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <Info className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {items.length > 0 && disclaimerOpen ? (
        <p
          id="reels-disclaimer"
          className="relative z-20 shrink-0 pb-2 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] text-xs leading-relaxed text-white/75"
        >
          {SYSTEM_REEL_DISCLAIMER}
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))]">
          <EmptyLineState className="text-white/80">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <CivicBubble className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Ingen Reels publisert ennå</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/75">
              {SYSTEM_REEL_DISCLAIMER} Godkjente ja/nei/blank-spørsmål fra stortingssaker vises her når de er
              publisert.
            </p>
          </EmptyLineState>
        </div>
      ) : isDesktop ? (
        /* Desktop (lg+): 21st Coverflow rack — not fullscreen single cards, no sideways peek bleed */
        <LayoutGroup id="reels-coverflow">
          <ReelsExpandPortalProvider container={expandPortalEl}>
          <motion.div
            className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]"
            animate={{
              scale: detailExpanded && !reducedMotion ? 0.94 : 1,
              opacity: detailExpanded ? 0.45 : 1,
            }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : detailExpanded
                  ? { duration: 0.35 }
                  : { duration: 0.25 }
            }
          >
            <CoverflowCarousel
              key={`coverflow-${initialIndex}`}
              initialIndex={initialIndex}
              label="Reels"
              loop={items.length >= 3}
              showPagination
              showNavigation
              interactionLocked={cardOpen || detailExpanded}
              onIndexChange={handleCenteredIndexChange}
              rotate={40}
              depth={0.55}
              perspective={2.8}
              cardWidth="clamp(220px, 28vw, 320px)"
              cardHeight="clamp(320px, 58dvh, 440px)"
              gap={0.08}
              cardClassName="rounded-2xl border border-white/10 bg-[#00205b]"
              slides={items.map((item, index) => (
                <ReelCarouselCard
                  key={item.poll.id}
                  item={item}
                  showBadge={false}
                  selected={activePollId === item.poll.id}
                  isCentered={index === centeredIndex}
                  expanded={expandedPollId === item.poll.id}
                  onSelect={() => handlePollSelect(item.poll.id)}
                  onBack={() => handlePollSelect(null)}
                  onExpandedChange={(open) => setExpandedPollId(open ? item.poll.id : null)}
                  mode="coverflow"
                />
              ))}
            />
          </motion.div>
          <div ref={setExpandPortalEl} className="pointer-events-none fixed inset-0 z-[225]" />
          </ReelsExpandPortalProvider>
        </LayoutGroup>
      ) : (
        /* Mobile + tablet (<lg): Stories carousel (vertikal Tiktok-lignende, full høyde) */
        <LayoutGroup id="reels-stories">
          <ReelsExpandPortalProvider container={expandPortalEl}>
          <motion.div
            className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden pl-[max(0.5rem,env(safe-area-inset-left,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))]"
            animate={{
              scale: detailExpanded && !reducedMotion ? 0.96 : 1,
              opacity: detailExpanded ? 0.45 : 1,
            }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : detailExpanded
                  ? { duration: 0.35 }
                  : { duration: 0.25 }
            }
          >
            <div className="relative mx-auto flex min-h-0 w-full max-w-[26rem] flex-1 flex-col">
              <Stories
                key={`stories-${initialIndex}`}
                initialIndex={initialIndex}
                loop={items.length > 1}
                onIndexChange={handleCenteredIndexChange}
              >
                <div className="flex items-center justify-between gap-1.5 px-2 pb-1">
                  <div className="min-w-0 flex-1 overflow-x-auto pr-2">
                    <StoriesHeader className="px-0" />
                  </div>
                  <StoriesCounter className="shrink-0 tabular-nums text-[11px] sm:text-xs" />
                  <StoriesNavigationInline className="shrink-0" />
                </div>
                <StoriesContent className="min-h-0 flex-1" interactionLocked={cardOpen || detailExpanded}>
                  {items.map((item, index) => (
                    <Story key={item.poll.id} className="flex flex-col">
                      <ReelCarouselCard
                        item={item}
                        showBadge={false}
                        selected={activePollId === item.poll.id}
                        isCentered={index === centeredIndex}
                        expanded={expandedPollId === item.poll.id}
                        onSelect={() => handlePollSelect(item.poll.id)}
                        onBack={() => handlePollSelect(null)}
                        onExpandedChange={(open) => setExpandedPollId(open ? item.poll.id : null)}
                        mode="stories"
                      />
                    </Story>
                  ))}
                </StoriesContent>
              </Stories>
            </div>
          </motion.div>
          <div ref={setExpandPortalEl} className="pointer-events-none fixed inset-0 z-[225]" />
          </ReelsExpandPortalProvider>
        </LayoutGroup>
      )}
    </div>
  );
}
