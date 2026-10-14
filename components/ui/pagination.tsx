'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
};

type PageToken = number | 'gap';

export function getPageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens: PageToken[] = [];
  for (let page = 1; page <= totalPages; page += 1) {
    const isEdge = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;
    if (isEdge || isNearCurrent) {
      tokens.push(page);
    } else if (tokens[tokens.length - 1] !== 'gap') {
      tokens.push('gap');
    }
  }
  return tokens;
}

/** Responsiv paginering med utvidbar ellipse (…). */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = 'Paginering',
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const tokens = getPageTokens(currentPage, totalPages);
  const buttonBase =
    'inline-flex h-11 min-w-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Forrige side"
        className={cn(buttonBase, 'border-border bg-card px-2 text-foreground hover:bg-muted')}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {tokens.map((token, index) =>
        token === 'gap' ? (
          <span
            key={`gap-${index}`}
            aria-hidden
            className="inline-flex h-11 min-w-6 items-end justify-center pb-3 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <button
            key={token}
            type="button"
            onClick={() => onPageChange(token)}
            aria-label={`Side ${token}`}
            aria-current={token === currentPage ? 'page' : undefined}
            className={cn(
              buttonBase,
              token === currentPage
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted',
            )}
          >
            {token}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Neste side"
        className={cn(buttonBase, 'border-border bg-card px-2 text-foreground hover:bg-muted')}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
