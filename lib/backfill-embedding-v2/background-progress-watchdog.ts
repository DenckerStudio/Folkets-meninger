export const BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX =
  '[backfill-v2] ingen background-fremdrift';

export const DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS = 900_000;

export type BackgroundProgressWatchdog = {
  touchBackgroundSave: () => void;
  setBackgroundPending: (pending: boolean) => void;
  setTier0Pending: (tier0: boolean) => void;
  start: () => void;
  stop: () => void;
};

export type CreateBackgroundProgressWatchdogOptions = {
  timeoutMs: number;
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
  let backgroundPending = false;
  let tier0Pending = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const evaluate = (): void => {
    if (tier0Pending) {
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
      lastBackgroundSaveMs = now();
    },
    setBackgroundPending: (pending: boolean) => {
      backgroundPending = pending;
    },
    setTier0Pending: (tier0: boolean) => {
      tier0Pending = tier0;
    },
    start: () => {
      if (started) {
        return;
      }
      started = true;
      lastBackgroundSaveMs = now();
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
