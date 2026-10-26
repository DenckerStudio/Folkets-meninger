import { parseSchedule } from './schedule';
import { parseBackfillProvider, type BackfillProvider } from './provider';

export type BackfillCli = {
  provider?: BackfillProvider;
  maxBatchesPerMin: number;
  fullMaxBatchesPerMin: number;
  fastLaneMinBatchesPerMin: number;
  dryRun: boolean;
  stopFile: string | null;
  schedule: string | null;
  scheduleTimeZone: string;
  busyPause: boolean | undefined;
  busyLatencyMs: number;
  probeBeforeBatch: boolean;
  allowGpu: boolean;
  preflightOnly: boolean;
  leaseSeconds: number;
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

  const busyPause = readBoolOption(argv, '--busy-pause');
  const busyLatencyMs = Math.max(
    400,
    Number(readValue(argv, '--busy-latency-ms') ?? '1500') || 1500,
  );

  const leaseSeconds = Math.max(
    30,
    Math.min(3600, Number(readValue(argv, '--lease-seconds') ?? '300') || 300),
  );

  const providerRaw = readValue(argv, '--provider');
  const provider = providerRaw ? parseBackfillProvider(providerRaw) : undefined;

  return {
    provider,
    maxBatchesPerMin,
    fullMaxBatchesPerMin,
    fastLaneMinBatchesPerMin,
    dryRun: readFlag(argv, '--dry-run'),
    stopFile: readValue(argv, '--stop-file') ?? null,
    schedule: readValue(argv, '--schedule') ?? null,
    scheduleTimeZone: readValue(argv, '--schedule-tz') ?? 'Europe/Oslo',
    busyPause,
    busyLatencyMs,
    probeBeforeBatch: readFlag(argv, '--probe-before-batch'),
    allowGpu: readFlag(argv, '--allow-gpu'),
    preflightOnly: readFlag(argv, '--preflight-only'),
    leaseSeconds,
  };
}

export function loadScheduleWindows(cli: BackfillCli) {
  if (!cli.schedule) return [];
  return parseSchedule(cli.schedule);
}
