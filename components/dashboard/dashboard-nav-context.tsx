'use client';

import { createContext, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import ForumSidebar from '@/components/forum/forum-sidebar';
import { ForumDrawerProfile } from '@/components/forum/forum-drawer-profile';

type DashboardNavContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const DashboardNavContext = createContext<DashboardNavContextValue | null>(null);

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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] xl:hidden" role="dialog" aria-modal="true" aria-label="Navigasjonsmeny">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Lukk meny"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(100vw-3rem,300px)] flex-col bg-gray-50 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-gray-900">Meny</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" onClick={onClose}>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-gray-100" />}>
            <ForumSidebar />
          </Suspense>
          <ForumDrawerProfile onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}

export function DashboardNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

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

  return (
    <button
      type="button"
      onClick={() => nav.setOpen(true)}
      className={className}
      aria-expanded={nav.open}
      aria-label="Åpne meny"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
