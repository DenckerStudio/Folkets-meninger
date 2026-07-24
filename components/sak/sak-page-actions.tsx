'use client';

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { routes } from '@/lib/routes';
import ShareButton from '@/app/dashboard/sak/[id]/share-button';

type SakPageActionsProps = {
  sakId: string;
  title: string;
  className?: string;
};

export function SakPageActions({ sakId, title, className = '' }: SakPageActionsProps) {
  const forumHref = `${routes.forum}?sak=${sakId}`;

  return (
    <nav
      aria-label="Sakshandlinger"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`.trim()}
    >
      <Link
        href={forumHref}
        className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
        Diskuter i forum
      </Link>
      <ShareButton id={sakId} title={title} />
    </nav>
  );
}
