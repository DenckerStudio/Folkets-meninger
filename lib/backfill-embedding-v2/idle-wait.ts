export type WatchdogIdleHooks = {
  touch?: () => void;
  pause?: () => void;
  resume?: () => void;
};

/** Intentional worker sleep — pauses that worker's stall watchdog while waiting. */
export async function idleWait(
  sleep: (ms: number) => Promise<void>,
  ms: number,
  hooks: WatchdogIdleHooks = {},
): Promise<void> {
  hooks.touch?.();
  hooks.pause?.();
  try {
    await sleep(ms);
  } finally {
    hooks.resume?.();
  }
}
