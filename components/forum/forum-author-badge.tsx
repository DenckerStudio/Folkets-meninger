import { BadgeCheck } from 'lucide-react';
import Link from 'next/link';
import type { ForumAuthorDisplay } from '@/lib/forum/author-display';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';

type ForumAuthorBadgeProps = {
  author: ForumAuthorDisplay;
  className?: string;
  showPlatformHint?: boolean;
};

export function ForumAuthorBadge({
  author,
  className,
  showPlatformHint = false,
}: ForumAuthorBadgeProps) {
  const name = <span className="text-sm font-medium text-gray-900 truncate">{author.name}</span>;
  const canLink = author.kind === 'user' && author.userId;

  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          author.kind === 'platform'
            ? 'bg-indigo-100 text-indigo-800'
            : 'bg-gray-100 text-gray-700',
        )}
        aria-hidden
      >
        {author.initials}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {canLink ? (
            <Link href={routes.profile(author.userId!)} className="hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
          {author.kind === 'platform' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 border border-indigo-100">
              <BadgeCheck className="w-3 h-3" />
              Plattform
            </span>
          )}
        </div>
        {author.kind === 'platform' && showPlatformHint && (
          <p className="text-xs text-gray-500 mt-0.5">
            Automatisk tråd fra dagens avstemning
          </p>
        )}
      </div>
    </div>
  );
}
