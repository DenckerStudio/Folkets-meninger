import type { ReactNode } from 'react';
import { SakOversiktToc, type SakOversiktTocEntry } from '@/components/sak/sak-oversikt-toc';

export function SakOversiktShell({
  toc,
  children,
}: {
  toc: SakOversiktTocEntry[];
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 pb-[max(5rem,env(safe-area-inset-bottom))] lg:pb-0">
      <SakOversiktToc entries={toc} variant="mobile" />
      <div className="mt-4 flex flex-col gap-6 lg:mt-0 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
        <SakOversiktToc entries={toc} variant="desktop" />
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}