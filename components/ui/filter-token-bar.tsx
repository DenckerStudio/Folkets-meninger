'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ListFilter, Search, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useBodyOverlayFlag } from '@/hooks/use-body-overlay';
import { cn } from '@/lib/utils';

export type FilterTokenOption = {
  value: string;
  label: string;
};

export type FilterToken = {
  id: string;
  label: string;
  value: string;
  options: FilterTokenOption[];
  onChange: (value: string) => void;
};

type FilterTokenBarProps = {
  tokens: FilterToken[];
  leading?: ReactNode;
  className?: string;
  'aria-label'?: string;
};

const MENU_WIDTH = 240;

function defaultValueOf(token: FilterToken) {
  return token.options[0]?.value;
}

/** Horisontal filter-token-bar (21st.dev / laziekiki, tilpasset tema). */
export function FilterTokenBar({ tokens, leading, className, 'aria-label': ariaLabel }: FilterTokenBarProps) {
  const isMobile = useIsMobile();
  const isMounted = useIsMounted();
  const [openId, setOpenId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openToken = tokens.find((token) => token.id === openId) ?? null;
  const activeCount = tokens.filter((token) => token.value !== defaultValueOf(token)).length;

  useBodyOverlayFlag(Boolean(openId) && isMobile);

  useEffect(() => {
    if (!openId) return;

    const close = () => setOpenId(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [openId]);

  function openTokenMenu(token: FilterToken, event: React.MouseEvent<HTMLButtonElement>) {
    if (openId === token.id) {
      setOpenId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
    const menuHeight = 384;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const top = spaceBelow >= menuHeight ? rect.bottom + 8 : rect.top - menuHeight - 8;
    setMenuPosition({ top: Math.max(8, top), left });
    setOpenId(token.id);
  }

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {leading}
        {tokens.map((token) => {
          const active = token.value !== defaultValueOf(token);
          const current = token.options.find((option) => option.value === token.value);
          return (
            <button
              key={token.id}
              type="button"
              data-filter-token={token.id}
              aria-haspopup="listbox"
              aria-expanded={openId === token.id}
              onClick={(event) => openTokenMenu(token, event)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-brand/40 bg-brand-soft text-brand'
                  : 'border-border bg-card text-foreground hover:bg-muted',
              )}
            >
              <ListFilter className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <span>{token.label}</span>
              {current && active ? (
                <>
                  <span className="opacity-60">·</span>
                  <span className="max-w-[9rem] truncate">{current.label}</span>
                </>
              ) : null}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </button>
          );
        })}
      </div>

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            tokens.forEach((token) => token.onChange(defaultValueOf(token) ?? ''));
            setOpenId(null);
          }}
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Nullstill
        </button>
      ) : null}

      {isMounted
        ? createPortal(
            <AnimatePresence>
              {openToken && isMobile ? (
                <>
                  <motion.button
                    type="button"
                    key="filter-backdrop"
                    aria-label="Lukk filtre"
                    className="fixed inset-0 z-[65] bg-foreground/45 backdrop-blur-[1px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpenId(null)}
                  />
                  <motion.div
                    key="filter-sheet"
                    ref={menuRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Velg ${openToken.label}`}
                    className="fixed inset-x-0 bottom-0 z-[70] max-h-[min(80vh,560px)] overflow-y-auto rounded-t-2xl border border-border bg-popover pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] shadow-2xl"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 32, stiffness: 360, mass: 0.9 }}
                  >
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-popover/95 px-4 py-3 backdrop-blur">
                      <p className="text-sm font-semibold text-foreground">{openToken.label}</p>
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="min-h-11 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Lukk
                      </button>
                    </div>
                    <div className="p-2">
                      <FilterOptionsList
                        token={openToken}
                        onSelect={(value) => {
                          openToken.onChange(value);
                          setOpenId(null);
                        }}
                      />
                    </div>
                  </motion.div>
                </>
              ) : null}

              {openToken && !isMobile && menuPosition ? (
                <motion.div
                  key="filter-menu"
                  ref={menuRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH }}
                  className="z-[80] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg"
                >
                  <FilterOptionsList
                    token={openToken}
                    onSelect={(value) => {
                      openToken.onChange(value);
                      setOpenId(null);
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}

function FilterOptionsList({
  token,
  onSelect,
}: {
  token: FilterToken;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const showSearch = token.options.length > 8;
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? token.options.filter((option) => option.label.toLowerCase().includes(trimmed))
    : token.options;

  return (
    <div className="flex min-h-0 flex-col">
      {showSearch ? (
        <div className="relative shrink-0 px-1 pt-1 pb-1.5">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Filtrer ${token.label.toLowerCase()}…`}
            aria-label={`Filtrer ${token.label}`}
            autoComplete="off"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          />
          {query ? (
            <button
              type="button"
              aria-label="Tøm søk"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <ul
        role="listbox"
        aria-label={token.label}
        className="max-h-[min(60vh,24rem)] space-y-0.5 overflow-y-auto overscroll-contain px-0.5"
      >
        {filtered.length === 0 ? (
          <li key="empty" className="px-3 py-2.5 text-sm text-muted-foreground">
            Ingen treff
          </li>
        ) : (
          filtered.map((option) => {
            const selected = option.value === token.value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(option.value)}
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    selected ? 'bg-brand-soft text-brand' : 'text-foreground hover:bg-muted',
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
