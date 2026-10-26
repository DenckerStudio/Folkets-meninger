import assert from 'node:assert/strict';
import {
  LatencyBackoff,
  effectiveMaxBatchesPerMinute,
  shouldSleepForBatchRate,
} from './backfill-embedding-v2/busy-pause';
import { validateEmbeddingVector, buildSaveRows } from './backfill-embedding-v2/embed-batch';
import { parseSchedule, scheduleModeAt } from './backfill-embedding-v2/schedule';
import {
  checkEmbedUrlsAtStartup,
  isGpuOllamaUrl,
  isChatQueryEmbedUrl,
} from './backfill-embedding-v2/urls';
import { parseBackfillArgv } from './backfill-embedding-v2/parse-args';
import { requireBackfillUrl, parseBackfillProvider } from './backfill-embedding-v2/provider';
import { formatOllamaShowForLog } from './backfill-embedding-v2/ollama-show';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function vec1024(): number[] {
  return Array.from({ length: 1024 }, (_, i) => i / 1024);
}

async function main(): Promise<void> {
  const windows = parseSchedule('22-07:full,07-22:throttle');
  assert.equal(windows.length, 2);

  const cli = parseBackfillArgv(['--lease-seconds', '300', '--preflight-only']);
  assert.equal(cli.leaseSeconds, 300);
  assert.equal(cli.preflightOnly, true);

  assert.throws(() => requireBackfillUrl('lmstudio', ''));
  assert.throws(() => checkEmbedUrlsAtStartup('http://gpu:11434', '', false, false));
  assert.doesNotThrow(() =>
    checkEmbedUrlsAtStartup('http://gpu:11434', '', true, false),
  );

  const chatCheck = checkEmbedUrlsAtStartup(
    'http://cpu:11435',
    'http://cpu:11435',
    false,
    undefined,
  );
  assert.equal(chatCheck.chatInstance, true);
  assert.equal(chatCheck.busyPauseDefault, true);

  assert.equal(isGpuOllamaUrl('http://x:11434'), true);
  assert.equal(parseBackfillProvider('ollama'), 'ollama');

  const showLog = formatOllamaShowForLog({
    model: 'bge-m3',
    details: { quantization_level: 'F16' },
  });
  assert.match(showLog, /bge-m3/);
  assert.match(showLog, /F16/);

  const backoff = new LatencyBackoff(1000);
  backoff.resetForTests();
  backoff.record(2000);
  assert.equal(backoff.isPaused(), true);

  assert.equal(
    effectiveMaxBatchesPerMinute({
      tier0Pending: true,
      lane: 'background',
      scheduleMode: 'full',
      busyPauseEnabled: true,
      latencyPaused: true,
      maxBatchesPerMin: 10,
      fastLaneMinBatchesPerMin: 2,
    }),
    0,
  );

  const good = vec1024();
  assert.ok(validateEmbeddingVector({ embeddings: [good] }));

  const rows = buildSaveRows([{ id: 'a', content: 'x' }], new Map([['a', good]]));
  assert.match(rows[0].embedding, /^\[/);

  const stopPath = join(tmpdir(), `fm-backfill-stop-${Date.now()}`);
  writeFileSync(stopPath, '');
  assert.equal(existsSync(stopPath), true);
  unlinkSync(stopPath);

  const mode = scheduleModeAt(windows, new Date('2026-10-26T08:00:00+02:00'), 'Europe/Oslo');
  assert.equal(mode, 'throttle');

  console.log('backfill-embedding-v2.test.ts: ok');
}

void main();
