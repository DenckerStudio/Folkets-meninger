import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  padded?: boolean;
};

/** Standard dashboard card: semantic surface, shared radius and border. */
export function SurfaceCard({ children, className, padded = true }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card shadow-sm',
        padded && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
