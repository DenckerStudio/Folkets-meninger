'use client';

import type { MouseEvent } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { sakPageTabPanelId } from '@/lib/sak/anchors';
import { sakDocumentsLinkLabel } from '@/lib/sak/documents-filter';
import { waitForElementById } from '@/lib/sak/page-search-nav';
import { sakPageTabHref } from '@/lib/sak/sak-page-tabs';
import { navigateToSakTab } from '@/lib/sak/sak-tab-navigate';

/**
 * Oversikten viser bare en lenke til fanen Dokumenter. Selve listen (med søk og filter) ligger
 * under fanen, så den gjentas ikke her.
 */
export function SakDocumentsShortlist({
  sakId,
  documentCount,
}: {
  sakId: string;
  documentCount: number;
}) {
  if (documentCount <= 0) return null;

  const href = sakPageTabHref(`/dashboard/sak/${encodeURIComponent(sakId)}`, 'dokumenter');

  async function openDocumentsTab(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    navigateToSakTab('dokumenter');
    const panel = await waitForElementById(sakPageTabPanelId('dokumenter'), { timeoutMs: 5_000, pollMs: 40 });
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section
      id="sak-dokument-kortliste"
      data-sak-dokument-kortliste=""
      className="rounded-2xl border border-border bg-card px-4 py-1 shadow-sm sm:px-5"
    >
      <a
        href={href}
        onClick={openDocumentsTab}
        className="flex min-h-11 items-center justify-between gap-3 rounded-xl text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <span className="break-words">{sakDocumentsLinkLabel(documentCount)}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </a>
    </section>
  );
}