'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { MODAL_TRANSITION } from '@/lib/motion/tokens';
import { useReelsExpandPortal } from '@/components/polls/reels-expand-portal';
import { cn } from '@/lib/utils';

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function subscribeMobile(onStoreChange: () => void) {
  const mq = window.matchMedia('(max-width: 767px)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function useIsMobileViewport() {
  return useSyncExternalStore(subscribeMobile, getMobile, () => false);
}

type ReelExpandedShellProps = {
  open: boolean;
  onClose: () => void;
  layoutId: string;
  title: string;
  children: ReactNode;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function ReelExpandedShell({
  open,
  onClose,
  layoutId,
  title,
  children,
  closeButtonRef,
  returnFocusRef,
}: ReelExpandedShellProps) {
  const mounted = useIsMounted();
  const portalRoot = useReelsExpandPortal();
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobileViewport();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(open, panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, closeButtonRef]);

  useEffect(() => {
    if (open) return;
    const el = returnFocusRef?.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => el.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open, returnFocusRef]);

  if (!mounted || !portalRoot) return null;

  const layoutTransition = reducedMotion
    ? { layout: { duration: 0 }, duration: 0 }
    : { layout: { type: 'spring' as const, stiffness: 340, damping: 34 } };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="reel-expanded-layer" className="contents">
          <motion.button
            type="button"
            aria-label="Lukk utvidet kort"
            className="pointer-events-auto fixed inset-0 z-[225] bg-black/55"
            onClick={onClose}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : MODAL_TRANSITION}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            layoutId={layoutId}
            layout={!reducedMotion}
            transition={layoutTransition}
            className={cn(
              'pointer-events-auto fixed z-[230] flex min-h-0 flex-col overflow-hidden border border-white/15 bg-[#00205b] text-white shadow-2xl',
              isMobile
                ? 'inset-0 rounded-none pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]'
                : 'left-1/2 top-1/2 h-[min(90dvh,720px)] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl',
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
              <p id={titleId} className="sr-only">{title}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/70">Hva mener du?</p>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Lukk"
                className="ml-auto shrink-0 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
