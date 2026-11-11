import assert from 'node:assert/strict';
import {
  BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX,
  createBackgroundProgressWatchdog,
  DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS,
  DEFAULT_TIER0_STARVATION_MS,
  evaluateBackgroundStall,
  evaluateTier0Starvation,
  TIER0_STARVATION_LOG_PREFIX,
} from './background-progress-watchdog';

function makeWatchdog(
  now: () => number,
  calls: Array<() => void>,
  options: {
    timeoutMs?: number;
    tier0StarvationMs?: number;
    pollMs?: number;
    log?: (line: string) => void;
    exit?: (code: number) => never;
  } = {},
) {
  let exitCode: number | null = null;
  const watchdog = createBackgroundProgressWatchdog({
    timeoutMs: options.timeoutMs ?? DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS,
    tier0StarvationMs: options.tier0StarvationMs ?? DEFAULT_TIER0_STARVATION_MS,
    now,
    setIntervalFn: (fn) => {
      calls.push(fn);
      return { unref: () => {} } as NodeJS.Timeout;
    },
    clearIntervalFn: () => {},
    pollMs: options.pollMs ?? 60_000,
    log: options.log,
    exit:
      options.exit ??
      ((code) => {
        exitCode = code;
        throw new Error('exit');
      }),
  });
  return { watchdog, getExitCode: () => exitCode };
}

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
  assert.equal(evaluateTier0Starvation(DEFAULT_TIER0_STARVATION_MS - 1, DEFAULT_TIER0_STARVATION_MS), false);
  assert.equal(evaluateTier0Starvation(DEFAULT_TIER0_STARVATION_MS, DEFAULT_TIER0_STARVATION_MS), true);
}

function testStallTriggersRecovery(): void {
  let now = 0;
  const logs: string[] = [];
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    log: (line) => logs.push(line),
  });

  watchdog.start();
  watchdog.setTier0Pending(false);
  watchdog.touchBackgroundSave();
  now = 500_000;
  watchdog.touchBackgroundSave();

  let threw = false;
  try {
    now = 1_500_000;
    calls[0]!();
  } catch {
    threw = true;
  }

  assert.equal(threw, true);
  assert.equal(getExitCode(), 2);
  assert.ok(logs.some((line) => line.includes(BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testTier0ClearDoesNotFalsePositive(): void {
  let now = 0;
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, { pollMs: 10_000 });

  watchdog.start();
  watchdog.setTier0Pending(true);
  now = 5_000_000;
  watchdog.setTier0Pending(false);
  now += 100_000;
  calls[0]!();
  assert.equal(getExitCode(), null);
  watchdog.stop();
}

function testBackgroundPendingArmsOnFalseToTrue(): void {
  let now = 0;
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    timeoutMs: 100_000,
    pollMs: 10_000,
  });

  watchdog.start();
  watchdog.setTier0Pending(false);
  watchdog.setBackgroundPending(false);
  now = 200_000;
  watchdog.setBackgroundPending(true);
  now += 50_000;
  calls[0]!();
  assert.equal(getExitCode(), null);
  watchdog.stop();
}

function testRepeatedClaimsWithoutSaveStall(): void {
  let now = 0;
  const logs: string[] = [];
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    timeoutMs: 100_000,
    pollMs: 10_000,
    log: (line) => logs.push(line),
  });

  watchdog.start();
  watchdog.setTier0Pending(false);
  watchdog.touchBackgroundSave();
  now = 10_000;

  for (let i = 0; i < 20; i += 1) {
    watchdog.noteBackgroundClaimAttempt();
    now += 10_000;
  }

  let threw = false;
  try {
    now = 120_000;
    calls[0]!();
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(getExitCode(), 2);
  assert.ok(logs.some((line) => line.includes(BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testArmedFromStartBeforeClaim(): void {
  let now = 0;
  const logs: string[] = [];
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    timeoutMs: 60_000,
    pollMs: 5_000,
    log: (line) => logs.push(line),
  });

  watchdog.start();
  watchdog.setTier0Pending(false);

  let threw = false;
  try {
    now = 70_000;
    calls[0]!();
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(getExitCode(), 2);
  assert.ok(logs.some((line) => line.includes(BACKGROUND_PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testTier0StarvationWithoutFastSaves(): void {
  let now = 0;
  const logs: string[] = [];
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    tier0StarvationMs: 100_000,
    pollMs: 10_000,
    log: (line) => logs.push(line),
  });

  watchdog.start();
  watchdog.setTier0Pending(true);

  let threw = false;
  try {
    now = 150_000;
    calls[0]!();
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(getExitCode(), 2);
  assert.ok(logs.some((line) => line.includes(TIER0_STARVATION_LOG_PREFIX)));
}

function testTier0WithPeriodicFastSavesSurvives(): void {
  let now = 0;
  const calls: Array<() => void> = [];
  const { watchdog, getExitCode } = makeWatchdog(() => now, calls, {
    tier0StarvationMs: 100_000,
    pollMs: 20_000,
  });

  watchdog.start();
  watchdog.setTier0Pending(true);

  for (let i = 0; i < 5; i += 1) {
    now += 50_000;
    watchdog.touchFastLaneSave();
    calls[0]!();
  }
  assert.equal(getExitCode(), null);
  watchdog.stop();
}

void testEvaluatePendingZero();
testStallTriggersRecovery();
testTier0ClearDoesNotFalsePositive();
testBackgroundPendingArmsOnFalseToTrue();
testRepeatedClaimsWithoutSaveStall();
testArmedFromStartBeforeClaim();
testTier0StarvationWithoutFastSaves();
testTier0WithPeriodicFastSavesSurvives();

console.log('lib/backfill-embedding-v2/background-progress-watchdog.test.ts: ok');
