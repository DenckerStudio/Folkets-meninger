import assert from 'node:assert/strict';
import { parseBackfillArgv } from './backfill-embedding-v2/parse-args';
import { DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS } from './backfill-embedding-v2/background-progress-watchdog';
import {
  createWorkerWatchdogRegistry,
  PROGRESS_WATCHDOG_LOG_PREFIX,
} from './backfill-embedding-v2/progress-watchdog';
import { idleWait } from './backfill-embedding-v2/idle-wait';

function makeRegistry(
  now: () => number,
  calls: Array<() => void>,
  options: {
    timeoutMs: number;
    exit: (code: number) => never;
    log?: (line: string) => void;
    pollMs?: number;
  },
) {
  const setIntervalFn = (fn: () => void) => {
    calls.push(fn);
    return { unref: () => {} } as NodeJS.Timeout;
  };

  return createWorkerWatchdogRegistry({
    timeoutMs: options.timeoutMs,
    now,
    setIntervalFn,
    clearIntervalFn: () => {},
    pollMs: options.pollMs ?? 100,
    log: options.log,
    exit: options.exit,
  });
}

function testHungWorkerExits(): void {
  let now = 0;
  const logs: string[] = [];
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const registry = makeRegistry(
    () => now,
    calls,
    {
      timeoutMs: 600,
      log: (line) => logs.push(line),
      exit: (code) => {
        exitCode = code;
        throw new Error('exit');
      },
    },
  );

  registry.registerWorker('server');
  registry.start();
  now = 700;
  assert.throws(() => calls[0]!(), /exit/);
  assert.equal(exitCode, 2);
  assert.ok(logs.some((line) => line.includes('[server]')));
}

function testWatchdogResetsOnProgress(): void {
  let now = 0;
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const registry = makeRegistry(
    () => now,
    calls,
    {
      timeoutMs: 600,
      exit: (code) => {
        exitCode = code;
        throw new Error('exit');
      },
    },
  );

  const worker = registry.registerWorker('server');
  registry.start();
  now = 400;
  worker.touch();
  now = 700;
  calls[0]!();
  assert.equal(exitCode, null);
  registry.stop();
}

async function testIdleFastLaneWaitDoesNotExitAsync(): Promise<void> {
  let now = 0;
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const registry = makeRegistry(
    () => now,
    calls,
    {
      timeoutMs: 600_000,
      exit: (code) => {
        exitCode = code;
        throw new Error('exit');
      },
      pollMs: 30_000,
    },
  );

  const worker = registry.registerWorker('server');
  registry.start();

  for (let i = 0; i < 12; i += 1) {
    worker.touch();
    await idleWait(async (ms) => {
      now += ms;
      calls[0]!();
    }, 60_000, worker);
    now += 5_000;
    calls[0]!();
  }

  assert.equal(exitCode, null);
  assert.ok(now > 600_000);
}

function testCoordinatorLoopDoesNotMaskHungEmbed(): void {
  let now = 0;
  const logs: string[] = [];
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const registry = makeRegistry(
    () => now,
    calls,
    {
      timeoutMs: 600,
      log: (line) => logs.push(line),
      exit: (code) => {
        exitCode = code;
        throw new Error('exit');
      },
    },
  );

  registry.registerWorker('server');
  registry.start();

  let coordinatorThrew = false;
  try {
    for (let tick = 0; tick < 200; tick += 1) {
      now += 5_000;
      calls[0]!();
    }
  } catch {
    coordinatorThrew = true;
  }
  assert.equal(coordinatorThrew, true);
  assert.equal(exitCode, 2);
  assert.ok(logs.some((line) => line.includes('[server]')));
}

function testIdleWorkerDoesNotMaskHungPeer(): void {
  let now = 0;
  const logs: string[] = [];
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const registry = makeRegistry(
    () => now,
    calls,
    {
      timeoutMs: 600,
      log: (line) => logs.push(line),
      exit: (code) => {
        exitCode = code;
        throw new Error('exit');
      },
    },
  );

  const idlePrimary = registry.registerWorker('primary-ollama');
  registry.registerWorker('stuck-embed');
  registry.start();

  let peerThrew = false;
  try {
    for (let i = 0; i < 20; i += 1) {
      idlePrimary.touch();
      idlePrimary.pause();
      now += 60_000;
      calls[0]!();
      idlePrimary.resume();
      now += 5_000;
      calls[0]!();
    }
    now += 100;
    calls[0]!();
  } catch {
    peerThrew = true;
  }
  assert.equal(peerThrew, true);
  assert.equal(exitCode, 2);
  assert.ok(logs.some((line) => line.includes('[stuck-embed]')));
  assert.ok(logs.some((line) => line.includes(PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testParseTimeoutDefaults(): void {
  const cli = parseBackfillArgv([]);
  assert.equal(cli.embedHttpTimeoutMs, 60_000);
  assert.equal(cli.dbRpcTimeoutMs, 30_000);
  assert.equal(cli.progressWatchdogMs, 600_000);
  assert.equal(cli.backgroundProgressWatchdogMs, DEFAULT_BACKGROUND_PROGRESS_WATCHDOG_MS);
}

async function main(): Promise<void> {
  testHungWorkerExits();
  testWatchdogResetsOnProgress();
  testParseTimeoutDefaults();
  testCoordinatorLoopDoesNotMaskHungEmbed();
  testIdleWorkerDoesNotMaskHungPeer();
  await testIdleFastLaneWaitDoesNotExitAsync();
  console.log('backfill-embedding-v2-stall-guard.test.ts: ok');
}

void main();
