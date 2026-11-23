import type { ReactNode } from 'react';
import { SakOversiktTocProvider } from '@/components/sak/sak-oversikt-toc-provider';
import type { SakOversiktTocEntry } from '@/components/sak/sak-oversikt-toc';
import type { SakOversiktRelatertTocInput } from '@/lib/sak/sak-oversikt-related-toc';

export function SakOversiktShell({
  toc,
  relatedToc,
  children,
}: {
  toc: SakOversiktTocEntry[];
  relatedToc: SakOversiktRelatertTocInput;
  children: ReactNode;
}) {
  return (
    <SakOversiktTocProvider baseEntries={toc} staticRelated={relatedToc}>
      {children}
    </SakOversiktTocProvider>
  );
}