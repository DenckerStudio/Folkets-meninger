export const BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX =
  '[backfill-v2] ingen background-fremdrift';

export const TIER0_STARVATION_LOG_PREFIX =
  '[backfill-v2] tier-0 blokkerer for lenge uten fast-lane-fremdrift';

export const DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS = 900_000;
export const DEFAULT_TIER0_STARVATION_MS = 1_800_000;

export type BackgroundProgressWatchdog = {
  touchBackgroundSave: () => void;
  touchFastLaneSave: () => void;
  noteBackgroundClaimAttempt: () => void;
  setBackgroundPending: (pending: boolean) => void;
  setTier0Pending: (tier0: boolean) => void;
  start: () => void;
  stop: () => void;
};

export type CreateBackgroundProgressWatchdogOptions = {
  timeoutMs: number;
  tier0StarvationMs: number;
  now?: () => number;
  setIntervalFn?: (handler: () => void, delay?: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: typeof clearInterval;
  log?: (line: string) => void;
  exit?: (code: number) => never;
  pollMs?: number;
};

export function createBackgroundProgressWatchdog(
  options: CreateBackgroundProgressWatchdogOptions,
): BackgroundProgressWatchdog {
  const now = options.now ?? (() => Date.now());
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const log = options.log ?? ((line: string) => console.error(line));
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const pollMs = options.pollMs ?? 30_000;

  let lastBackgroundSaveMs = now();
  let lastFastLaneSaveMs = now();
  let backgroundPending = true;
  let tier0Pending = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const resetBackgroundTimer = (): void => {
    lastBackgroundSaveMs = now();
  };

  const evaluate = (): void => {
    if (tier0Pending) {
      const sinceFastMs = now() - lastFastLaneSaveMs;
      if (sinceFastMs >= options.tier0StarvationMs) {
        log(
          `${TIER0_STARVATION_LOG_PREFIX} på ${Math.round(sinceFastMs / 1000)}s uten fast-lane-lagring (grense ${Math.round(options.tier0StarvationMs / 1000)}s) — avslutter med kode 2 for restart`,
        );
        exit(2);
      }
      return;
    }
    if (!backgroundPending) {
      return;
    }
    const elapsed = now() - lastBackgroundSaveMs;
    if (elapsed >= options.timeoutMs) {
      log(
        `${BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX} på ${Math.round(elapsed / 1000)}s (grense ${Math.round(options.timeoutMs / 1000)}s) — avslutter med kode 2 for restart`,
      );
      exit(2);
    }
  };

  return {
    touchBackgroundSave: () => {
      resetBackgroundTimer();
    },
    touchFastLaneSave: () => {
      lastFastLaneSaveMs = now();
    },
    noteBackgroundClaimAttempt: () => {
      if (!backgroundPending) {
        backgroundPending = true;
        resetBackgroundTimer();
      }
    },
    setBackgroundPending: (pending: boolean) => {
      const was = backgroundPending;
      backgroundPending = pending;
      if (pending && !was) {
        resetBackgroundTimer();
      }
    },
    setTier0Pending: (tier0: boolean) => {
      const was = tier0Pending;
      tier0Pending = tier0;
      if (tier0 && !was) {
        lastFastLaneSaveMs = now();
      }
      if (!tier0 && was) {
        resetBackgroundTimer();
      }
    },
    start: () => {
      if (started) {
        return;
      }
      started = true;
      const startMs = now();
      lastBackgroundSaveMs = startMs;
      lastFastLaneSaveMs = startMs;
      backgroundPending = true;
      timer = setIntervalFn(evaluate, pollMs);
      if (timer && typeof timer === 'object' && 'unref' in timer) {
        timer.unref();
      }
    },
    stop: () => {
      if (timer !== null) {
        clearIntervalFn(timer);
        timer = null;
      }
      started = false;
    },
  };
}

/** Test-only snapshot of evaluate inputs. */
export function evaluateBackgroundStall(
  state: {
    tier0Pending: boolean;
    backgroundPending: boolean;
    elapsedMs: number;
  },
  timeoutMs: number,
): boolean {
  if (state.tier0Pending || !state.backgroundPending) {
    return false;
  }
  return state.elapsedMs >= timeoutMs;
}

export function evaluateTier0Starvation(
  sinceFastLaneSaveMs: number,
  tier0StarvationMs: number,
): boolean {
  return sinceFastLaneSaveMs >= tier0StarvationMs;
}
