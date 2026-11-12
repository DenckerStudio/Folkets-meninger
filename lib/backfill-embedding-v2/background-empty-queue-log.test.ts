import assert from 'node:assert/strict';
import {
  BACKGROUND_EMPTY_QUEUE_LOG_LINE,
  createBackgroundEmptyQueueLog,
  DEFAULT_BACKGROUND_EMPTY_QUEUE_LOG_THROTTLE_MS,
} from './background-empty-queue-log';

function runThrottleTest(): void {
  let t = 0;
  const lines: string[] = [];
  const logger = createBackgroundEmptyQueueLog({
    log: (line) => lines.push(line),
    throttleMs: DEFAULT_BACKGROUND_EMPTY_QUEUE_LOG_THROTTLE_MS,
    now: () => t,
  });

  logger.maybeLogEmptyBackgroundQueue();
  assert.equal(lines.length, 1);
  assert.equal(lines[0], BACKGROUND_EMPTY_QUEUE_LOG_LINE);

  t += 60_000;
  logger.maybeLogEmptyBackgroundQueue();
  assert.equal(lines.length, 1);

  t += 600_000;
  logger.maybeLogEmptyBackgroundQueue();
  assert.equal(lines.length, 2);

  logger.resetThrottle();
  logger.maybeLogEmptyBackgroundQueue();
  assert.equal(lines.length, 3);
}

runThrottleTest();
console.log('lib/backfill-embedding-v2/background-empty-queue-log.test.ts: ok');
