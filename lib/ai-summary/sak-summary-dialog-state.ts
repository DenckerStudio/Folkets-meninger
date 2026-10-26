export type SummaryLoadState = 'idle' | 'loading' | 'ready' | 'read_failed' | 'timeout';

export function isSummaryErrorState(loadState: SummaryLoadState): boolean {
  return loadState === 'read_failed' || loadState === 'timeout';
}

/** After closing the dialog: keep loaded summary for admin rating; clear transient errors. */
export function loadStateAfterDialogClose(
  hasData: boolean,
  loadState: SummaryLoadState,
): SummaryLoadState {
  if (isSummaryErrorState(loadState)) {
    return 'idle';
  }
  if (loadState === 'loading') {
    return hasData ? 'ready' : 'idle';
  }
  return hasData ? 'ready' : 'idle';
}

export function shouldRefetchOnDialogOpen(
  hasData: boolean,
  refetchOnNextOpen: boolean,
): boolean {
  return refetchOnNextOpen || !hasData;
}

export function refetchOnNextOpenAfterClose(
  hasData: boolean,
  loadState: SummaryLoadState,
): boolean {
  return !hasData || isSummaryErrorState(loadState);
}

export function isActivePollGeneration(generation: number, activeGeneration: number): boolean {
  return generation === activeGeneration;
}
