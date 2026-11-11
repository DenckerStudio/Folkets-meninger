import assert from 'node:assert/strict';
import {
  BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX,
  createBackgroundProgressWatchdog,
  DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS,
  evaluateBackgroundStall,
} from './background-progress-watchdog';

function testEvaluatePendingZero(): void {
  assert.equal(
    evaluateBackgroundStall(
      { tier0Pending: false, backgroundPending: false, elapsedMs: 9_999_999 },
      DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS,
    ),
    false,
  );
  assert.equal(
    evaluateBackgroundStall(
      { tier0Pending: true, backgroundPending: true, elapsedMs: 9_999_999 },
      DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS,
    ),
    false,
  );
}

function testStallTriggersRecovery(): void {
  let now = 0;
  const logs: string[] = [];
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const watchdog = createBackgroundProgressWatchdog({
    timeoutMs: 900_000,
    now: () => now,
    setIntervalFn: (fn) => {
      calls.push(fn);
      return { unref: () => {} } as NodeJS.Timeout;
    },
    clearIntervalFn: () => {},
    pollMs: 60_000,
    log: (line) => logs.push(line),
    exit: (code) => {
      exitCode = code;
      throw new Error('exit');
    },
  });

  watchdog.start();
  watchdog.setBackgroundPending(true);
  watchdog.setTier0Pending(false);
  watchdog.touchBackgroundSave();
  now = 500_000;
  watchdog.touchBackgroundSave();

  let fastLaneThrew = false;
  try {
    now = 1_500_000;
    calls[0]!();
  } catch {
    fastLaneThrew = true;
  }

  assert.equal(fastLaneThrew, true);
  assert.equal(exitCode, 2);
  assert.ok(logs.some((line) => line.includes(BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testFastLaneDoesNotResetBackgroundTimer(): void {
  let now = 0;
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const watchdog = createBackgroundProgressWatchdog({
    timeoutMs: 900_000,
    now: () => now,
    setIntervalFn: (fn) => {
      calls.push(fn);
      return { unref: () => {} } as NodeJS.Timeout;
    },
    clearIntervalFn: () => {},
    pollMs: 50_000,
    exit: (code) => {
      exitCode = code;
      throw new Error('exit');
    },
  });

  watchdog.start();
  watchdog.setBackgroundPending(true);
  watchdog.setTier0Pending(false);
  watchdog.touchBackgroundSave();

  for (let i = 0; i < 8; i += 1) {
    now += 100_000;
    calls[0]!();
  }

  assert.equal(exitCode, null, 'per-worker fast-lane touch skal ikke forlenge background-timer');

  let threw = false;
  try {
    now = 950_000;
    calls[0]!();
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(exitCode, 2);
  watchdog.stop();
}

void testEvaluatePendingZero();
testStallTriggersRecovery();
testFastLaneDoesNotResetBackgroundTimer();

console.log('lib/backfill-embedding-v2/background-progress-watchdog.test.ts: ok');
