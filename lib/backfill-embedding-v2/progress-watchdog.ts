export const PROGRESS_WATCHDOG_LOG_PREFIX = '[backfill-v2] ingen fremdrift';

export const DEFAULT_PROGRESS_WATCHDOG_MS = 600_000;
export const DEFAULT_EMBED_HTTP_TIMEOUT_MS = 60_000;
export const DEFAULT_DB_RPC_TIMEOUT_MS = 30_000;

export type ProgressWatchdog = {
  touch: () => void;
  start: () => void;
  stop: () => void;
};

export type CreateProgressWatchdogOptions = {
  timeoutMs: number;
  now?: () => number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  log?: (line: string) => void;
  exit?: (code: number) => never;
  /** How often to evaluate stall (default 30s). */
  pollMs?: number;
};

export function createProgressWatchdog(options: CreateProgressWatchdogOptions): ProgressWatchdog {
  const now = options.now ?? (() => Date.now());
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const log = options.log ?? ((line: string) => console.error(line));
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const pollMs = options.pollMs ?? 30_000;

  let lastProgressMs = now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const touch = (): void => {
    lastProgressMs = now();
  };

  const evaluate = (): void => {
    const elapsed = now() - lastProgressMs;
    if (elapsed >= options.timeoutMs) {
      log(
        `${PROGRESS_WATCHDOG_LOG_PREFIX} på ${Math.round(elapsed / 1000)}s (grense ${Math.round(options.timeoutMs / 1000)}s) — avslutter med kode 2 for restart`,
      );
      exit(2);
    }
  };

  const start = (): void => {
    if (started) return;
    started = true;
    touch();
    timer = setIntervalFn(evaluate, pollMs);
    if (timer && typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }
  };

  const stop = (): void => {
    if (timer !== null) {
      clearIntervalFn(timer);
      timer = null;
    }
    started = false;
  };

  return { touch, start, stop };
}
