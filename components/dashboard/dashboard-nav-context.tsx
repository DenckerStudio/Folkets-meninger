'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import DashboardSidebar from '@/components/dashboard/dashboard-sidebar';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

type DashboardNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

const DRAWER_SPRING = { type: 'spring' as const, damping: 30, stiffness: 340, mass: 0.85 };
const BACKDROP_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

export function useDashboardNav() {
  const ctx = useContext(DashboardNavContext);
  if (!ctx) {
    throw new Error('useDashboardNav must be used within DashboardNavProvider');
  }
  return ctx;
}

export function useDashboardNavOptional() {
  return useContext(DashboardNavContext);
}

function DashboardNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const panelTransition = reducedMotion ? { duration: 0 } : DRAWER_SPRING;
  const backdropTransition = reducedMotion ? { duration: 0 } : BACKDROP_TRANSITION;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] xl:hidden" role="presentation">
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-label="Lukk meny"
            onClick={onClose}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={backdropTransition}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Navigasjonsmeny"
            className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col bg-muted/40 shadow-2xl"
            initial={reducedMotion ? false : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? undefined : { x: '-100%' }}
            transition={panelTransition}
          >
            <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <span className="text-sm font-semibold text-foreground">Meny</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
              onClick={onClose}
            >
              <DashboardSidebar />
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function DashboardNavProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <DashboardNavContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <DashboardNavDrawer open={open} onClose={() => setOpen(false)} />
    </DashboardNavContext.Provider>
  );
}

export function DashboardNavMenuButton({ className }: { className?: string }) {
  const nav = useDashboardNavOptional();
  const reducedMotion = usePrefersReducedMotion();
  if (!nav) return null;

  return (
    <button
      type="button"
      onClick={nav.toggle}
      className={cn(className, 'relative active:scale-95')}
      aria-expanded={nav.open}
      aria-label={nav.open ? 'Lukk meny' : 'Åpne meny'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={nav.open ? 'close' : 'open'}
          className="inline-flex"
          initial={reducedMotion ? false : { opacity: 0, rotate: nav.open ? -90 : 90, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, rotate: nav.open ? 90 : -90, scale: 0.8 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
        >
          {nav.open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
