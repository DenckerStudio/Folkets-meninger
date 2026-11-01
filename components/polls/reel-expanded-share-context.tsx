'use client';

import { createContext, useContext, type ReactNode } from 'react';

type ReelExpandedShareContextValue = {
  setShareDialogOpen: (open: boolean) => void;
};

const ReelExpandedShareContext = createContext<ReelExpandedShareContextValue | null>(null);

export function ReelExpandedShareProvider({
  children,
  setShareDialogOpen,
}: {
  children: ReactNode;
  setShareDialogOpen: (open: boolean) => void;
}) {
  return (
    <ReelExpandedShareContext.Provider value={{ setShareDialogOpen }}>
      {children}
    </ReelExpandedShareContext.Provider>
  );
}

export function useReelExpandedShareDialog(): ReelExpandedShareContextValue | null {
  return useContext(ReelExpandedShareContext);
}
