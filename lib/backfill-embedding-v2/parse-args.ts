import { parseSchedule } from './schedule';

export type BackfillCli = {
  workers: number;
  workerIndex: number;
  batch: number;
  maxBatchesPerMin: number;
  fullMaxBatchesPerMin: number;
  fastLaneMinBatchesPerMin: number;
  tiers: number[];
  dryRun: boolean;
  stopFile: string | null;
  quietHours: string | null;
  schedule: string | null;
  scheduleTimeZone: string;
  busyPause: boolean | undefined;
  busyLatencyMs: number;
  probeBeforeBatch: boolean;
  allowGpu: boolean;
  summaryOnSakComplete: boolean;
};

function readFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function readValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = argv.indexOf(name);
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) {
    return argv[idx + 1];
  }
  return undefined;
}

function readBoolOption(argv: string[], name: string): boolean | undefined {
  const raw = readValue(argv, name);
  if (raw === undefined) return undefined;
  if (raw === 'on' || raw === 'true' || raw === '1') return true;
  if (raw === 'off' || raw === 'false' || raw === '0') return false;
  throw new Error(`Ugyldig ${name}=${raw} (bruk on/off)`);
}

export function parseBackfillArgv(argv: string[]): BackfillCli {
  const workers = Math.max(1, Math.min(16, Number(readValue(argv, '--workers') ?? '1') || 1));
  const workerIndex = Math.max(
    0,
    Math.min(workers - 1, Number(readValue(argv, '--worker-index') ?? '0') || 0),
  );
  const batch = Math.max(8, Math.min(64, Number(readValue(argv, '--batch') ?? '16') || 16));
  const maxBatchesPerMin = Math.max(
    1,
    Number(readValue(argv, '--max-batches-per-min') ?? '3') || 3,
  );
  const fullMaxBatchesPerMin = Math.max(
    maxBatchesPerMin,
    Number(readValue(argv, '--full-max-batches-per-min') ?? '60') || 60,
  );
  const fastLaneMinBatchesPerMin = Math.max(
    1,
    Number(readValue(argv, '--fast-lane-min-batches-per-min') ?? '1') || 1,
  );

  const tiersRaw = readValue(argv, '--tiers') ?? '0,1,2,3';
  const tiers = tiersRaw
    .split(',')
    .map((t) => Number(t.trim()))
    .filter((t) => Number.isFinite(t) && t >= 0 && t <= 3);

  if (tiers.length === 0) {
    throw new Error('--tiers må inneholde minst én tier (0–3)');
  }

  const busyPause = readBoolOption(argv, '--busy-pause');
  const busyLatencyMs = Math.max(
    400,
    Number(readValue(argv, '--busy-latency-ms') ?? '1500') || 1500,
  );

  return {
    workers,
    workerIndex,
    batch,
    maxBatchesPerMin,
    fullMaxBatchesPerMin,
    fastLaneMinBatchesPerMin,
    tiers,
    dryRun: readFlag(argv, '--dry-run'),
    stopFile: readValue(argv, '--stop-file') ?? null,
    quietHours: readValue(argv, '--quiet-hours') ?? null,
    schedule: readValue(argv, '--schedule') ?? null,
    scheduleTimeZone: readValue(argv, '--schedule-tz') ?? 'Europe/Oslo',
    busyPause,
    busyLatencyMs,
    probeBeforeBatch: readFlag(argv, '--probe-before-batch'),
    allowGpu: readFlag(argv, '--allow-gpu'),
    summaryOnSakComplete: readFlag(argv, '--summary-on-sak-complete'),
  };
}

export function loadScheduleWindows(cli: BackfillCli) {
  if (!cli.schedule) return [];
  return parseSchedule(cli.schedule);
}
