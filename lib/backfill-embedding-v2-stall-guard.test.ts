import assert from 'node:assert/strict';
import { fetchWithTimeout, EMBED_HTTP_TIMEOUT_MESSAGE } from './backfill-embedding-v2/fetch-with-timeout';
import {
  createProgressWatchdog,
  PROGRESS_WATCHDOG_LOG_PREFIX,
} from './backfill-embedding-v2/progress-watchdog';
import { parseBackfillArgv } from './backfill-embedding-v2/parse-args';

function hangUntilAbortFetch(): typeof fetch {
  return (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
}

async function testFetchTimeoutAborts(): Promise<void> {
  const fetchImpl = hangUntilAbortFetch();

  let message = '';
  try {
    await fetchWithTimeout(
      'http://ollama-host.example.invalid:11435/api/embed',
      { method: 'POST', body: '{}' },
      { timeoutMs: 25, fetchImpl },
    );
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  assert.equal(message, EMBED_HTTP_TIMEOUT_MESSAGE);
}

function testWatchdogFiresOnStall(): void {
  let now = 0;
  const logs: string[] = [];
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const setIntervalFn = (fn: () => void) => {
    calls.push(fn);
    return { unref: () => {} } as NodeJS.Timeout;
  };

  const watchdog = createProgressWatchdog({
    timeoutMs: 600,
    now: () => now,
    setIntervalFn,
    clearIntervalFn: () => {},
    pollMs: 100,
    log: (line) => logs.push(line),
    exit: (code) => {
      exitCode = code;
      throw new Error('exit');
    },
  });

  watchdog.start();
  now = 700;
  assert.throws(() => calls[0]!(), /exit/);
  assert.equal(exitCode, 2);
  assert.ok(logs.some((line) => line.includes(PROGRESS_WATCHDOG_LOG_PREFIX)));
}

function testWatchdogResetsOnProgress(): void {
  let now = 0;
  let exitCode: number | null = null;
  const calls: Array<() => void> = [];

  const setIntervalFn = (fn: () => void) => {
    calls.push(fn);
    return { unref: () => {} } as NodeJS.Timeout;
  };

  const watchdog = createProgressWatchdog({
    timeoutMs: 600,
    now: () => now,
    setIntervalFn,
    clearIntervalFn: () => {},
    pollMs: 100,
    exit: (code) => {
      exitCode = code;
      throw new Error('exit');
    },
  });

  watchdog.start();
  now = 400;
  watchdog.touch();
  now = 700;
  calls[0]!();
  assert.equal(exitCode, null);
  watchdog.stop();
}

function testParseTimeoutDefaults(): void {
  const cli = parseBackfillArgv([]);
  assert.equal(cli.embedHttpTimeoutMs, 60_000);
  assert.equal(cli.dbRpcTimeoutMs, 30_000);
  assert.equal(cli.progressWatchdogMs, 600_000);
}

async function main(): Promise<void> {
  await testFetchTimeoutAborts();
  testWatchdogFiresOnStall();
  testWatchdogResetsOnProgress();
  testParseTimeoutDefaults();
  console.log('backfill-embedding-v2-stall-guard.test.ts: ok');
}

void main();
