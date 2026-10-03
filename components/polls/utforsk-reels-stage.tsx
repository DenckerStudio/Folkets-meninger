'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Compass, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Swiper as SwiperType } from 'swiper';
import { CardCarousel } from '@/components/ui/card-carousel';
import { ReelCarouselCard } from '@/components/polls/reel-vote-card';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import type { SystemReelFeedItem } from '@/lib/polls/types';
import { cn } from '@/lib/utils';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';

/** Quiet fullscreen ease — no lateral slide. */
const MODAL_EASE = [0.22, 1, 0.36, 1] as const;
const MODAL_TRANSITION = { duration: 0.36, ease: MODAL_EASE } as const;

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
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
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
                  className="fixed inset-0 z-[70] overflow-y-auto bg-background"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.992 }}
                  transition={reducedMotion ? { duration: 0 } : MODAL_TRANSITION}
                >
                  <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-6 sm:px-6">
                    <ReelsPanel
                      active={reelsOpen}
                      items={items}
                      activePollId={activePollId}
                      onSelect={setActivePollId}
                      onClose={closeReels}
                    />
                  </div>
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
  BadgeIcon: typeof Sparkles;
};

function reelsNavCopy(direction: 'forward' | 'back', itemCount: number): ReelsNavCopy {
  switch (direction) {
    case 'forward':
      return {
        badge: 'Reels',
        title: 'Del din mening',
        subtitle:
          itemCount > 0
            ? 'Si ja eller nei på systemgenererte spørsmål fra stortingssaker.'
            : 'Ingen Reels er publisert ennå. Åpne for å se status.',
        BadgeIcon: Sparkles,
      };
    case 'back':
      return {
        badge: 'Utforsk',
        title: 'Tilbake til saker',
        subtitle: 'Lovforslag og representantforslag fra Stortinget — kildedokumenter.',
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
  const reducedMotion = usePrefersReducedMotion();
  const swiperRef = useRef<SwiperType | null>(null);

  useEffect(() => {
    const autoplay = swiperRef.current?.autoplay;
    if (!autoplay) return;
    if (!active || activePollId) autoplay.stop();
    else autoplay.start();
  }, [active, activePollId]);

  return (
    <div className="space-y-4 pb-8">
      <ReelsBackCta onBack={onClose} />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <Sparkles className="h-6 w-6 text-brand" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Ingen Reels publisert ennå</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Når administratorer har godkjent systemgenererte spørsmål fra stortingssaker, vises de her.
          </p>
        </div>
      ) : (
        <CardCarousel
          title="Reels"
          description="Bla mellom spørsmål. Trykk på et kort for å stemme ja eller nei."
          badge={
            <>
              <Sparkles className="fill-brand-accent/30 stroke-1 text-brand" /> Systemgenerert
            </>
          }
          autoplayDelay={reducedMotion ? 0 : 2200}
          showPagination
          showNavigation
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
          }}
          slides={items.map((item) => (
            <ReelCarouselCard
              key={item.poll.id}
              item={item}
              selected={activePollId === item.poll.id}
              onSelect={() => onSelect(item.poll.id)}
              onBack={() => onSelect(null)}
            />
          ))}
        />
      )}

      {items.length > 0 ? (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">{SYSTEM_REEL_DISCLAIMER}</p>
      ) : null}
    </div>
  );
}
