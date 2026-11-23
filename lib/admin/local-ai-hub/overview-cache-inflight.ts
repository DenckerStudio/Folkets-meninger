let inFlightOverviewLoad: Promise<unknown> | null = null;

export async function coalesceOverviewCacheLoad<T>(factory: () => Promise<T>): Promise<T> {
  if (inFlightOverviewLoad) {
    return inFlightOverviewLoad as Promise<T>;
  }

  const promise = factory().finally(() => {
    inFlightOverviewLoad = null;
  });
  inFlightOverviewLoad = promise;
  return promise;
}

export function clearOverviewInflightForTests(): void {
  inFlightOverviewLoad = null;
}

export function hasOverviewInflightForTests(): boolean {
  return inFlightOverviewLoad !== null;
}
