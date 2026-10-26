/** Idempotent stop + lease release for backfill workers and coordinator. */
export function createLeaseReleaseStopController(releaseAll: () => Promise<void>) {
  let stopping = false;
  let releaseOnce: Promise<void> | null = null;

  const requestStop = async (): Promise<void> => {
    if (!releaseOnce) {
      stopping = true;
      releaseOnce = releaseAll();
    }
    await releaseOnce;
  };

  return {
    requestStop,
    isStopping: () => stopping,
  };
}
