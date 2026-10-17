'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import DashboardSidebar from '@/components/dashboard/dashboard-sidebar';
import { DashboardSidebarProfile } from '@/components/dashboard/dashboard-sidebar-profile';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { useBodyOverlayFlag } from '@/hooks/use-body-overlay';
import { cn } from '@/lib/utils';

type DashboardNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

const PANEL_EASE = [0.32, 0.72, 0, 1] as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
}

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
  useBodyOverlayFlag(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Move focus into the dialog as soon as it opens.
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Trap Tab inside the dialog.
      const panel = panelRef.current;
      if (!panel) return;
      const items = getFocusableElements(panel);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const inside = active != null && panel.contains(active);

      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
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
            ref={panelRef}
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
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Lukk"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <DashboardSidebar variant="drawer" onNavigate={onClose} />
              </div>
              <DashboardSidebarProfile variant="drawer" onNavigate={onClose} />
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
  const wasOpenRef = useRef(false);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Return focus to the header menu button whenever the drawer closes. The
  // button is remounted on close, so resolve it by attribute rather than a
  // context-held ref (the compiler lint rejects refs read through context).
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      const id = window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('[data-nav-toggle]')?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
    wasOpenRef.current = open;
    return undefined;
  }, [open]);

  return (
    <DashboardNavContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <DashboardNavDrawer open={open} onClose={() => setOpen(false)} />
    </DashboardNavContext.Provider>
  );
}

export function DashboardNavMenuButton({ className }: { className?: string }) {
  const nav = useDashboardNavOptional();
  if (!nav) return null;

  // Hide the header toggle while the drawer is open so it never floats above
  // the backdrop; the drawer owns the open/close affordance and focus.
  if (nav.open) return null;

  return (
    <button
      data-nav-toggle
      type="button"
      onClick={nav.toggle}
      className={cn('min-h-[44px] min-w-[44px]', className)}
      aria-label="Åpne meny"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
