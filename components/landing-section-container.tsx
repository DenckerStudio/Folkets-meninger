import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type LandingSectionContainerProps = {
  children: ReactNode;
  className?: string;
  /** Inner content width (grid/cards); defaults to full 7xl column. */
  innerClassName?: string;
};

/** Shared landing section width — matches header/footer (max-w-7xl + horizontal padding). */
export function LandingSectionContainer({
  children,
  className,
  innerClassName,
}: LandingSectionContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      <div className={cn('w-full min-w-0', innerClassName)}>{children}</div>
    </div>
  );
}
