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

const PANEL_EASE = [0.32, 0.72, 0, 1] as const;

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

  const panelTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.26, ease: PANEL_EASE };
  const backdropTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: PANEL_EASE };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[60] xl:hidden" role="presentation">
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/50"
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
            className="absolute inset-y-0 left-0 flex w-[min(84vw,288px)] flex-col border-r border-border bg-background shadow-2xl"
            initial={reducedMotion ? false : { x: '-100%' }}
            animate={{ x: 0 }}
            exit={reducedMotion ? undefined : { x: '-100%' }}
            transition={panelTransition}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
              <span className="text-sm font-semibold tracking-tight text-foreground">Meny</span>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <DashboardSidebar variant="drawer" onNavigate={onClose} />
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
      className={cn(className)}
      aria-expanded={nav.open}
      aria-label={nav.open ? 'Lukk meny' : 'Åpne meny'}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={nav.open ? 'close' : 'open'}
          className="inline-flex"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.92 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
        >
          {nav.open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
