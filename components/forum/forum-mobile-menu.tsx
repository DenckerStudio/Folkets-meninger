'use client';

import { Suspense, useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import ForumSidebar from '@/components/forum/forum-sidebar';
import { cn } from '@/lib/utils';

function ForumSidebarDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Navigasjonsmeny">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Lukk meny"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 w-[min(100vw-3rem,280px)] bg-gray-50 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <span className="text-sm font-semibold text-gray-900">Meny</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" onClick={onClose}>
          <Suspense fallback={<div className="h-48 animate-pulse bg-gray-100 rounded-xl" />}>
            <ForumSidebar />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export function ForumMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm',
          'hover:border-gray-300 hover:bg-gray-50 transition-colors',
        )}
        aria-expanded={open}
        aria-controls="forum-mobile-drawer"
      >
        <Menu className="w-5 h-5" />
        Meny
      </button>
      <div id="forum-mobile-drawer">
        <ForumSidebarDrawer open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
