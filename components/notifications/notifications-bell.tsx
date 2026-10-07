"use client";

import * as React from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { loginWithNext } from '@/lib/safe-redirect';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import {
  NotificationPanel,
  type NotificationItem,
} from '@/components/ui/notification-panel';
import { mapApiNotification, type ApiNotification } from '@/components/notifications/map-notification';


const ARCHIVED_KEY = 'fs-varsler-archived';

function readArchived(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(ARCHIVED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeArchived(ids: Set<string>) {
  try {
    window.localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore quota / private mode
  }
}

type NotificationsBellProps = {
  className?: string;
  enabled?: boolean;
  loginHref?: string;
};

export function NotificationsBell({
  className,
  enabled = true,
  loginHref,
}: NotificationsBellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [anchor, setAnchor] = React.useState({ top: 64, right: 16 });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const isLoggedIn = Boolean(user) && enabled;

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const refreshUnread = React.useCallback(async () => {
    if (!isLoggedIn) {
      setUnread(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
      const json = await res.json();
      setUnread(Number(json.count || 0));
    } catch {
      // ignore
    }
  }, [isLoggedIn]);

  const loadItems = React.useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=100', { cache: 'no-store' });
      const json = await res.json();
      const archived = readArchived();
      const mapped = ((json.notifications || []) as ApiNotification[]).map((n) =>
        mapApiNotification(n, archived),
      );
      setItems(mapped);
      setUnread(mapped.filter((n) => n.unread && !n.archived).length);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    void refreshUnread();
    const timer = window.setInterval(() => void refreshUnread(), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, refreshUnread]);

  React.useEffect(() => {
    if (open && isLoggedIn) void loadItems();
  }, [open, isLoggedIn, loadItems]);
  const placeDesktop = React.useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchor({
      top: r.bottom + 8,
      right: Math.max(8, window.innerWidth - r.right),
    });
  }, []);

  React.useEffect(() => {
    if (!open || isMobile) return;
    placeDesktop();
    window.addEventListener("resize", placeDesktop);
    return () => window.removeEventListener("resize", placeDesktop);
  }, [open, isMobile, placeDesktop]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (isMobile) return;
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, isMobile]);

  React.useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', ids }),
    });
    void refreshUnread();
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    setItems((list) => list.map((n) => ({ ...n, unread: false })));
    setUnread(0);
  };

  const onReadChange = (item: NotificationItem, unreadNext: boolean) => {
    setItems((list) => list.map((n) => (n.id === item.id ? { ...n, unread: unreadNext } : n)));
    if (!unreadNext) void markRead([item.id]);
    setUnread((c) => Math.max(0, unreadNext ? c + 1 : c - 1));
  };

  const onArchiveChange = (item: NotificationItem, archived: boolean) => {
    const archivedIds = readArchived();
    if (archived) archivedIds.add(item.id);
    else archivedIds.delete(item.id);
    writeArchived(archivedIds);
    setItems((list) =>
      list.map((n) =>
        n.id === item.id ? { ...n, archived, unread: archived ? false : n.unread } : n,
      ),
    );
    if (archived && item.unread) void markRead([item.id]);
  };

  const onOpenItem = (item: NotificationItem) => {
    if (item.href) {
      setOpen(false);
      router.push(item.href);
    }
  };

  const onSettings = () => {
    setOpen(false);
    router.push(`${routes.minSide}?tab=preferanser`);
  };

  if (!isLoggedIn) {
    return (
      <Link
        href={loginHref || loginWithNext(routes.varsler)}
        className={cn(
          'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground',
          className,
        )}
        aria-label="Varsler"
      >
        <Bell className="size-4" />
      </Link>
    );
  }

  const panel = (
    <NotificationPanel
      ref={panelRef}
      items={items}
      maxHeight={isMobile ? null : 420}
      className={cn(
        isMobile ? 'h-full max-w-none rounded-none border-0 shadow-none' : 'shadow-lg',
      )}
      kindFilters={[
        { id: 'all', label: 'Alle typer' },
        { id: 'categories', label: 'Hjertesaker' },
        { id: 'labels', label: 'Emner' },
      ]}
      onMarkAllRead={() => void markAllRead()}
      onReadChange={onReadChange}
      onArchiveChange={onArchiveChange}
      onOpenItem={onOpenItem}
      onSettings={onSettings}
    />
  );

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Varsler"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {open ? (
                isMobile ? (
                  <motion.div
                    key="varsler-fs"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Varsler"
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="fixed inset-0 z-[80] flex flex-col bg-background pt-[env(safe-area-inset-top,0px)]"
                  >
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Lukk
                      </button>
                      {loading ? (
                        <span className="text-xs text-muted-foreground">Laster…</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Esc for å lukke</span>
                      )}
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden">{panel}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="varsler-dd"
                    role="dialog"
                    aria-label="Varsler"
                    initial={reduced ? false : { opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    className="fixed z-[80]"
                    style={{ top: anchor.top, right: anchor.right }}
                  >
                    {loading && items.length === 0 ? (
                      <div className="w-[min(100vw-1.5rem,440px)] rounded-[18px] border border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-lg">
                        Laster varsler…
                      </div>
                    ) : (
                      panel
                    )}
                  </motion.div>
                )
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
