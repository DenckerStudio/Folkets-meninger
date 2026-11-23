'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SakOversiktToc, type SakOversiktTocEntry } from '@/components/sak/sak-oversikt-toc';
import {
  SAK_OVERSIKT_RELATERT_ANCHOR_ID,
  sakOversiktRelatertTocLabel,
  type SakOversiktRelatertTocInput,
} from '@/lib/sak/sak-oversikt-related-toc';

export type SakOversiktRelatedTocPatch = {
  similarShowsSection: boolean;
};

type SakOversiktTocContextValue = {
  setRelatedTocPatch: (patch: SakOversiktRelatedTocPatch | null) => void;
};

const SakOversiktTocContext = createContext<SakOversiktTocContextValue | null>(null);

export function useSakOversiktRelatedTocPatch() {
  const ctx = useContext(SakOversiktTocContext);
  if (!ctx) {
    throw new Error('useSakOversiktRelatedTocPatch must be used within SakOversiktTocProvider');
  }
  return ctx.setRelatedTocPatch;
}

export function SakOversiktTocProvider({
  baseEntries,
  staticRelated,
  children,
}: {
  baseEntries: SakOversiktTocEntry[];
  staticRelated: SakOversiktRelatertTocInput;
  children: ReactNode;
}) {
  const [similarPatch, setSimilarPatch] = useState<SakOversiktRelatedTocPatch | null>(null);

  const setRelatedTocPatch = useCallback((patch: SakOversiktRelatedTocPatch | null) => {
    setSimilarPatch(patch);
  }, []);

  const entries = useMemo(() => {
    const similarShowsSection =
      similarPatch?.similarShowsSection ?? staticRelated.similarShowsSection;

    const mergedRelated: SakOversiktRelatertTocInput = {
      ...staticRelated,
      similarShowsSection,
    };

    const label = sakOversiktRelatertTocLabel(mergedRelated);
    const withoutRelated = baseEntries.filter((entry) => entry.id !== SAK_OVERSIKT_RELATERT_ANCHOR_ID);

    if (!label) {
      return withoutRelated;
    }

    return [
      ...withoutRelated,
      { id: SAK_OVERSIKT_RELATERT_ANCHOR_ID, label },
    ];
  }, [baseEntries, similarPatch, staticRelated]);

  return (
    <SakOversiktTocContext.Provider value={{ setRelatedTocPatch }}>
      <div className="min-w-0 pb-[max(5rem,env(safe-area-inset-bottom))] lg:pb-0">
        <SakOversiktToc entries={entries} variant="mobile" />
        <div className="mt-4 flex flex-col gap-6 lg:mt-0 lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <SakOversiktToc entries={entries} variant="desktop" />
          <div className="min-w-0 space-y-6">{children}</div>
        </div>
      </div>
    </SakOversiktTocContext.Provider>
  );
}