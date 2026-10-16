import Link from 'next/link';
import { Flag } from 'lucide-react';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type BiasReportLinkProps = {
  pagePath: string;
  className?: string;
};

/** Reuses site_feedback via /innspill with category skjevhet — no new migration. */
export function BiasReportLink({ pagePath, className }: BiasReportLinkProps) {
  const href = `${routes.innspill}?kategori=skjevhet&side=${encodeURIComponent(pagePath)}`;

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted',
        className,
      )}
    >
      <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      Meld fra om skjevhet
    </Link>
  );
}
