'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TeamProfileGridProps = {
  children: ReactNode;
  className?: string;
};

/** Team Profile Grid (21st.dev / shadcnstore team-1, tilpasset politikere). */
export function TeamProfileGrid({ children, className }: TeamProfileGridProps) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className,
      )}
    >
      {children}
    </ul>
  );
}

export function TeamProfileGridItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <li className={cn('min-w-0 list-none', className)}>{children}</li>;
}
