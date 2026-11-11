export const PROGRESS_WATCHDOG_LOG_PREFIX = '[backfill-v2] ingen fremdrift';

export const DEFAULT_PROGRESS_WATCHDOG_MS = 600_000;
export const DEFAULT_EMBED_HTTP_TIMEOUT_MS = 60_000;
export const DEFAULT_DB_RPC_TIMEOUT_MS = 30_000;

export type WorkerWatchdogHandle = {
  touch: () => void;
  pause: () => void;
  resume: () => void;
};

export type WorkerWatchdogRegistry = {
  registerWorker: (endpointName: string) => WorkerWatchdogHandle;
  start: () => void;
  stop: () => void;
};

export type WatchdogSetInterval = (
  handler: () => void,
  delay?: number,
) => ReturnType<typeof setInterval>;

export type CreateWorkerWatchdogRegistryOptions = {
  timeoutMs: number;
  now?: () => number;
  setIntervalFn?: WatchdogSetInterval;
  clearIntervalFn?: typeof clearInterval;
  log?: (line: string) => void;
  exit?: (code: number) => never;
  /** How often to evaluate stall (default 30s). */
  pollMs?: number;
};

type WorkerWatchdogState = {
  endpointName: string;
  lastProgressMs: number;
  paused: boolean;
};

export function createWorkerWatchdogRegistry(
  options: CreateWorkerWatchdogRegistryOptions,
): WorkerWatchdogRegistry {
  const now = options.now ?? (() => Date.now());
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const log = options.log ?? ((line: string) => console.error(line));
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const pollMs = options.pollMs ?? 30_000;

  const workers: WorkerWatchdogState[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const registerWorker = (endpointName: string): WorkerWatchdogHandle => {
    const state: WorkerWatchdogState = {
      endpointName,
      lastProgressMs: now(),
      paused: false,
    };
    workers.push(state);

    return {
      touch: () => {
        state.lastProgressMs = now();
      },
      pause: () => {
        state.paused = true;
        state.lastProgressMs = now();
      },
      resume: () => {
        state.paused = false;
        state.lastProgressMs = now();
      },
    };
  };

  const evaluate = (): void => {
    for (const worker of workers) {
      if (worker.paused) {
        continue;
      }
      const elapsed = now() - worker.lastProgressMs;
      if (elapsed >= options.timeoutMs) {
        log(
          `${PROGRESS_WATCHDOG_LOG_PREFIX} [${worker.endpointName}] på ${Math.round(elapsed / 1000)}s (grense ${Math.round(options.timeoutMs / 1000)}s) — avslutter med kode 2 for restart`,
        );
        exit(2);
      }
    }
  };

  const start = (): void => {
    if (started) {
      return;
    }
    started = true;
    const startMs = now();
    for (const worker of workers) {
      worker.lastProgressMs = startMs;
    }
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

  return { registerWorker, start, stop };
}
