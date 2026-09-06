import { HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';

type StemmePlusBadgeProps = {
  className?: string;
  size?: 'sm' | 'md';
};

export function StemmePlusBadge({ className, size = 'sm' }: StemmePlusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
        'border border-amber-200/80 dark:border-amber-800/60',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className,
      )}
      title="Stemme+ støttemedlem"
    >
      <HeartHandshake className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
      Stemme+
    </span>
  );
}
