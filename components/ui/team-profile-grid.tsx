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
        'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(4,minmax(0,1fr))]',
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
  return (
    <li className={cn('flex min-w-0 w-full list-none', className)}>{children}</li>
  );
}
