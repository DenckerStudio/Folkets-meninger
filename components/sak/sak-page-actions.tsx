'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { routes } from '@/lib/routes';
import ShareButton from '@/app/dashboard/sak/[id]/share-button';

type SakPageActionsProps = {
  sakId: string;
  title: string;
  /** Compact labels for sticky bars and repeated CTAs */
  variant?: 'default' | 'compact';
  className?: string;
};

export function SakPageActions({
  sakId,
  title,
  variant = 'default',
  className = '',
}: SakPageActionsProps) {
  const forumHref = `${routes.forum}?sak=${sakId}`;
  const isCompact = variant === 'compact';

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-3 ${className}`.trim()}
    >
      <Link
        href={forumHref}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-950/80 sm:w-auto sm:min-w-[10rem] ${
          isCompact ? 'py-2 text-xs sm:text-sm' : ''
        }`}
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
        <span>Diskuter i forum</span>
      </Link>
      <ShareButton
        id={sakId}
        title={title}
        className="w-full sm:w-auto justify-center"
        compact={isCompact}
      />
    </div>
  );
}
