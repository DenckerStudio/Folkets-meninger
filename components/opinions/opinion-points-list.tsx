import { STANCE_VISUAL } from '@/lib/opinions/labels';
import type { OpinionPoint } from '@/lib/opinions/types';
import { cn } from '@/lib/utils';

type OpinionPointsListProps = {
  points: OpinionPoint[];
  compact?: boolean;
  className?: string;
};

export function OpinionPointsList({ points, compact = false, className }: OpinionPointsListProps) {
  if (points.length === 0) return null;
  const shown = compact ? points.slice(0, 3) : points;

  return (
    <ul className={cn('space-y-1.5', className)}>
      {shown.map((point, index) => {
        const visual = STANCE_VISUAL[point.stance];
        return (
          <li key={`${point.stance}-${index}`} className="flex items-start gap-2 text-sm">
            <span
              className="mt-0.5 inline-flex min-w-[2.75rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: visual.bg, color: visual.fg }}
            >
              {visual.label}
            </span>
            <span className={cn('leading-relaxed', compact ? 'line-clamp-2 text-muted-foreground' : 'text-foreground')}>
              {point.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
