'use client';

import { createContext, useContext, type ReactNode } from 'react';

const ReelsExpandPortalContext = createContext<HTMLElement | null>(null);

export function ReelsExpandPortalProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return <ReelsExpandPortalContext.Provider value={container}>{children}</ReelsExpandPortalContext.Provider>;
}

export function useReelsExpandPortal() {
  return useContext(ReelsExpandPortalContext);
}
