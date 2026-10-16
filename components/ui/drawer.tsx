'use client';

import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useBodyOverlayFlag } from '@/hooks/use-body-overlay';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Mobil bunn-skuff (coss.com / drawer-mønster, uten ekstra avhengigheter). */
export function Drawer({ open, onClose, title, description, children, className }: DrawerProps) {
  const reducedMotion = usePrefersReducedMotion();
  useBodyOverlayFlag(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Lukk"
            onClick={onClose}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={panelTransition}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'absolute inset-x-0 bottom-0 flex max-h-[min(92vh,720px)] flex-col rounded-t-2xl border border-border bg-background shadow-2xl',
              className,
            )}
            initial={reducedMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reducedMotion ? undefined : { y: '100%' }}
            transition={panelTransition}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 pt-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                {description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
