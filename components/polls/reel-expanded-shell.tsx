'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useReelExpandMobile } from '@/hooks/use-reel-expand-mobile';
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
  const layoutPortalRoot = useReelsExpandPortal();
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useReelExpandMobile();
  const shareLayout = open && !isMobile && !reducedMotion;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const portalRoot = isMobile ? document.body : layoutPortalRoot;

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

  const clearPanelTransform = () => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = 'none';
  };

  useEffect(() => {
    if (!open || shareLayout) return;
    const id = window.requestAnimationFrame(clearPanelTransform);
    return () => window.cancelAnimationFrame(id);
  }, [open, shareLayout]);

  if (!mounted || !portalRoot) return null;

  const layoutTransition = reducedMotion
    ? { layout: { duration: 0 }, duration: 0 }
    : { layout: { type: 'spring' as const, stiffness: 340, damping: 34 } };

  const mobileEnter = reducedMotion ? { opacity: 1 } : { opacity: 1 };
  const mobileInitial = reducedMotion ? false : { opacity: 0 };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div key="reel-expanded-layer" className={isMobile ? 'contents' : 'contents'}>
          {!isMobile ? (
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
          ) : null}
          {isMobile ? (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={mobileInitial}
              animate={mobileEnter}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={clearPanelTransform}
              className="pointer-events-auto fixed inset-0 z-[400] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden border-0 bg-[#00205b] text-white"
              style={{ transform: 'none' }}
            >
              <div
                className="flex shrink-0 items-start justify-between gap-2 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
              >
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
          ) : (
            <div className="pointer-events-none fixed inset-0 z-[230] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                layoutId={shareLayout ? layoutId : undefined}
                layout={shareLayout}
                transition={layoutTransition}
                onLayoutAnimationComplete={clearPanelTransform}
                className="pointer-events-auto flex w-full max-w-[440px] max-h-[85vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#00205b] text-white shadow-2xl"
                style={{ transform: 'none' }}
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
                <div className="flex min-h-0 max-h-full flex-col overflow-hidden">{children}</div>
              </motion.div>
            </div>
          )}
        </div>
      ) : null}
    </AnimatePresence>,
    portalRoot,
  );
}
