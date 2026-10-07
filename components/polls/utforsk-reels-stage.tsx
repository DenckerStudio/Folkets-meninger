'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { CivicBubble } from '@/components/icons/civic';
import { EmptyLineState } from '@/components/motion/empty-line';
import { AnimatePresence, motion } from 'motion/react';
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel';
import { ReelCarouselCard } from '@/components/polls/reel-vote-card';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import type { SystemReelFeedItem } from '@/lib/polls/types';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MODAL_TRANSITION } from '@/lib/motion/tokens';

function subscribeLocationHash(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener('popstate', onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
  };
}

function getLocationHash() {
  return window.location.hash;
}

function getServerLocationHash() {
  return '';
}

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function subscribeMd(onStoreChange: () => void) {
  const mq = window.matchMedia('(min-width: 768px)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getMd() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function useIsDesktopMd() {
  return useSyncExternalStore(subscribeMd, getMd, () => false);
}

function notifyHashChanged() {
  window.dispatchEvent(new Event('hashchange'));
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
  const hash = useSyncExternalStore(subscribeLocationHash, getLocationHash, getServerLocationHash);
  const reelsOpen = hash === '#reels';
  const [activePollId, setActivePollId] = useState<string | null>(null);

  const openReels = useCallback(() => {
    if (window.location.hash !== '#reels') {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#reels`);
      notifyHashChanged();
    }
  }, []);

  const closeReels = useCallback(() => {
    setActivePollId(null);
    if (window.location.hash === '#reels') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      notifyHashChanged();
    }
  }, []);

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

  useEffect(() => {
    if (!reelsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeReels();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reelsOpen, closeReels]);

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

function ReelsPanel({
  active,
  items,
  activePollId,
  onSelect,
  onClose,
}: {
  active: boolean;
  items: SystemReelFeedItem[];
  activePollId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktopMd();
  const cardOpen = Boolean(activePollId);
  const [centeredIndex, setCenteredIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      if (activePollId) {
        onSelect(null);
        return;
      }
      const item = items[centeredIndex] ?? items[0];
      if (item) onSelect(item.poll.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, activePollId, centeredIndex, items, onSelect]);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {/* Header: back + REELS label so back never covers the card badge */}
      <div className="relative z-30 flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <button
          type="button"
          onClick={onClose}
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
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <EmptyLineState className="text-white/80">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <CivicBubble className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-white">Ingen Reels publisert ennå</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/75">
              {SYSTEM_REEL_DISCLAIMER} Godkjente ja/nei/blank-spørsmål fra stortingssaker vises her. Vi viser ikke
              mock-spørsmål.
            </p>
          </EmptyLineState>
        </div>
      ) : isDesktop ? (
        /* Desktop: 21st Coverflow rack — not fullscreen single cards, no sideways peek bleed */
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-2">
          <CoverflowCarousel
            label="Reels"
            loop={items.length >= 3}
            showPagination
            showNavigation
            interactionLocked={cardOpen}
            onIndexChange={setCenteredIndex}
            rotate={40}
            depth={0.55}
            perspective={2.8}
            cardWidth="clamp(220px, 28vw, 320px)"
            cardHeight="clamp(320px, 58vh, 440px)"
            gap={0.08}
            cardClassName="rounded-2xl border border-white/10 bg-[#00205b]"
            slides={items.map((item) => (
              <ReelCarouselCard
                key={item.poll.id}
                item={item}
                showBadge={false}
                selected={activePollId === item.poll.id}
                onSelect={() => onSelect(item.poll.id)}
                onBack={() => onSelect(null)}
              />
            ))}
          />
        </div>
      ) : (
        /* Mobile: fullscreen OK — one centred portrait card, coverflow neighbours faded */
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
          <CoverflowCarousel
            label="Reels"
            loop={items.length >= 3}
            showPagination
            showNavigation={false}
            interactionLocked={cardOpen}
            onIndexChange={setCenteredIndex}
            rotate={28}
            depth={0.45}
            perspective={2.4}
            fade={0.22}
            cardWidth="min(100vw - 1.5rem, 26rem)"
            cardHeight="min(72dvh, 34rem)"
            gap={0.12}
            cardClassName="rounded-2xl border border-white/10 bg-[#00205b]"
            slides={items.map((item) => (
              <ReelCarouselCard
                key={item.poll.id}
                item={item}
                showBadge={false}
                selected={activePollId === item.poll.id}
                onSelect={() => onSelect(item.poll.id)}
                onBack={() => onSelect(null)}
              />
            ))}
          />
        </div>
      )}

      {items.length > 0 ? (
        <p className="pointer-events-none z-20 shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-1 text-center text-xs leading-relaxed text-white/70">
          {SYSTEM_REEL_DISCLAIMER}
        </p>
      ) : null}
    </div>
  );
}
