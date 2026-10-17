import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

type NonRepresentativeNoticeProps = {
  count?: number;
  /** e.g. «stemmer», «holdninger», «meninger» */
  countLabel?: string;
  /** Singular form used when count is 1, e.g. «stemme». */
  countLabelSingular?: string;
  className?: string;
};

/**
 * Standard disclaimer for aggregates from app users — not population representative.
 */
export function NonRepresentativeNotice({
  count,
  countLabel = 'stemmer',
  countLabelSingular,
  className,
}: NonRepresentativeNoticeProps) {
  const label = count === 1 && countLabelSingular ? countLabelSingular : countLabel;
  const countPart =
    count != null && count > 0 ? ` (${formatNumber(count)} ${label})` : '';

  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      Blant brukerne av Folkets Meninger — ikke representativt for hele befolkningen.{countPart}
    </p>
  );
}
