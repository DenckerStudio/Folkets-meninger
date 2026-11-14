export const BACKGROUND_EMPTY_QUEUE_LOG_LINE =
  '[backfill-v2] background: tom kø (ingen claimbare rader)';

export const DEFAULT_BACKGROUND_EMPTY_QUEUE_LOG_THROTTLE_MS = 600_000;

export type BackgroundEmptyQueueLog = {
  maybeLogEmptyBackgroundQueue: () => void;
  resetThrottle: () => void;
};

export function createBackgroundEmptyQueueLog(options: {
  log: (line: string) => void;
  throttleMs?: number;
  now?: () => number;
}): BackgroundEmptyQueueLog {
  const throttleMs =
    options.throttleMs ?? DEFAULT_BACKGROUND_EMPTY_QUEUE_LOG_THROTTLE_MS;
  const now = options.now ?? (() => Date.now());
  let lastLoggedMs: number | null = null;

  return {
    maybeLogEmptyBackgroundQueue: () => {
      const t = now();
      if (lastLoggedMs !== null && t - lastLoggedMs < throttleMs) {
        return;
      }
      lastLoggedMs = t;
      options.log(BACKGROUND_EMPTY_QUEUE_LOG_LINE);
    },
    resetThrottle: () => {
      lastLoggedMs = null;
    },
  };
}
