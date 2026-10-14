'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useIsMounted } from '@/hooks/use-is-mounted';
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

function defaultValueOf(token: FilterToken) {
  return token.options[0]?.value;
}

/** Horisontal filger-token-bar (21st.dev / laziekiki, tilpasset tema). */
export function FilterTokenBar({ tokens, leading, className, 'aria-label': ariaLabel }: FilterTokenBarProps) {
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const openToken = tokens.find((token) => token.id === openId) ?? null;
  const activeCount = tokens.filter((token) => token.value !== defaultValueOf(token)).length;

  useEffect(() => {
    if (!openId || isMobile) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openId, isMobile]);

  const isMounted = useIsMounted();

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn(
        '-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {leading}
      {tokens.map((token) => {
        const active = token.value !== defaultValueOf(token);
        const current = token.options.find((option) => option.value === token.value);
        return (
          <div key={token.id} className="relative shrink-0">
            <button
              type="button"
              data-filter-token={token.id}
              aria-haspopup="listbox"
              aria-expanded={openId === token.id}
              onClick={() => setOpenId(openId === token.id ? null : token.id)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors',
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

            {openId === token.id && !isMobile ? (
              <div className="absolute left-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
                <FilterOptionsList
                  token={token}
                  onSelect={(value) => {
                    token.onChange(value);
                    setOpenId(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}

      {activeCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            tokens.forEach((token) => token.onChange(defaultValueOf(token) ?? ''));
            setOpenId(null);
          }}
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Nullstill filtre
        </button>
      ) : null}

      {isMounted && isMobile
        ? createPortal(
            <AnimatePresence>
              {openToken ? (
                <>
                  <motion.button
                    type="button"
                    aria-label="Lukk filtre"
                    className="fixed inset-0 z-[65] bg-foreground/45 backdrop-blur-[1px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setOpenId(null)}
                  />
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Velg ${openToken.label}`}
                    className="fixed inset-x-0 bottom-0 z-[70] max-h-[min(80vh,560px)] overflow-y-auto rounded-t-2xl border border-border bg-popover shadow-2xl"
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
                        className="rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        Lukk
                      </button>
                    </div>
                    <div className="p-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
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
  return (
    <ul role="listbox" aria-label={token.label} className="space-y-0.5">
      {token.options.map((option) => {
        const selected = option.value === token.value;
        return (
          <li key={option.value}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect(option.value)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                selected ? 'bg-brand-soft text-brand' : 'text-foreground hover:bg-muted',
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
