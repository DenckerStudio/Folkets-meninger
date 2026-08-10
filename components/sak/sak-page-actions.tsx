'use client';

import ShareButton from '@/app/dashboard/sak/[id]/share-button';

type SakPageActionsProps = {
  sakId: string;
  title: string;
  className?: string;
};

export function SakPageActions({ sakId, title, className = '' }: SakPageActionsProps) {
  return (
    <nav
      aria-label="Sakshandlinger"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`.trim()}
    >
      <ShareButton id={sakId} title={title} />
    </nav>
  );
}
