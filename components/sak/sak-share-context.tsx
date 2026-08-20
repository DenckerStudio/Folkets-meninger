'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { SakQuoteDialog } from '@/components/sak/sak-quote-dialog';
import { SakSelectionToolbar } from '@/components/sak/sak-selection-toolbar';
import { sakAbsoluteUrl, type QuoteShareDraft } from '@/lib/share';

type SakShareContextValue = {
  sakId: string;
  title: string;
  redditNeedsJoin: boolean;
  getPageUrl: () => string;
  openQuoteShare: (draft?: QuoteShareDraft) => void;
};

const SakShareContext = createContext<SakShareContextValue | null>(null);

export function useSakShare(): SakShareContextValue {
  const ctx = useContext(SakShareContext);
  if (!ctx) {
    throw new Error('useSakShare must be used within SakShareProvider');
  }
  return ctx;
}

export function useSakShareOptional(): SakShareContextValue | null {
  return useContext(SakShareContext);
}

export function SakShareProvider({
  sakId,
  title,
  redditNeedsJoin = false,
  children,
}: {
  sakId: string;
  title: string;
  redditNeedsJoin?: boolean;
  children: React.ReactNode;
}) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [draft, setDraft] = useState<QuoteShareDraft>({ quote: '' });

  const getPageUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    return sakAbsoluteUrl(window.location.origin, sakId);
  }, [sakId]);

  const openQuoteShare = useCallback((next?: QuoteShareDraft) => {
    setDraft({
      quote: next?.quote?.trim() ?? '',
      sourceLabel: next?.sourceLabel,
    });
    setQuoteOpen(true);
  }, []);

  const value = useMemo(
    () => ({ sakId, title, redditNeedsJoin, getPageUrl, openQuoteShare }),
    [sakId, title, redditNeedsJoin, getPageUrl, openQuoteShare],
  );

  return (
    <SakShareContext.Provider value={value}>
      {children}
      <SakSelectionToolbar />
      <SakQuoteDialog
        open={quoteOpen}
        sakId={sakId}
        title={title}
        getPageUrl={getPageUrl}
        draft={draft}
        onClose={() => setQuoteOpen(false)}
        onDraftChange={setDraft}
        redditNeedsJoin={redditNeedsJoin}
      />
    </SakShareContext.Provider>
  );
}
