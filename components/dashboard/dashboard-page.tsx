import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DashboardPageProps = {
  children: ReactNode;
  className?: string;
};

/** Shared dashboard content wrapper — consistent vertical rhythm inside the shell. */
export function DashboardPage({ children, className }: DashboardPageProps) {
  return (
    <div className={cn('space-y-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-24', className)}>
      {children}
    </div>
  );
}
