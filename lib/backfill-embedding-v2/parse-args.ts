import { parseSchedule } from './schedule';
import { parseBackfillProvider, type BackfillProvider } from './provider';
import {
  DEFAULT_DB_RPC_TIMEOUT_MS,
  DEFAULT_EMBED_HTTP_TIMEOUT_MS,
  DEFAULT_PROGRESS_WATCHDOG_MS,
} from './progress-watchdog';

export type BackfillCli = {
  provider?: BackfillProvider;
  maxBatchesPerMin: number;
  fullMaxBatchesPerMin: number;
  fastLaneMinBatchesPerMin: number;
  /** null = unlimited batches until stop signal */
  maxBatches: number | null;
  dryRun: boolean;
  stopFile: string | null;
  schedule: string | null;
  scheduleTimeZone: string;
  busyPause: boolean | undefined;
  busyLatencyMs: number;
  probeBeforeBatch: boolean;
  preflightOnly: boolean;
  leaseSeconds: number;
  embedHttpTimeoutMs: number;
  dbRpcTimeoutMs: number;
  progressWatchdogMs: number;
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

function readPositiveIntMs(
  argv: string[],
  flag: string,
  envName: string,
  fallback: number,
  label: string,
): number {
  const raw = readValue(argv, flag) ?? process.env[envName]?.trim();
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Ugyldig ${flag}=${raw} (${label})`);
  }
  return parsed;
}

function readBoolOption(argv: string[], name: string): boolean | undefined {
  const raw = readValue(argv, name);
  if (raw === undefined) return undefined;
  if (raw === 'on' || raw === 'true' || raw === '1') return true;
  if (raw === 'off' || raw === 'false' || raw === '0') return false;
  throw new Error(`Ugyldig ${name}=${raw} (bruk on/off)`);
}

/** Default 1 batch in dry-run; unlimited in normal mode unless --max-batches is set. */
export function resolveMaxBatches(argv: string[], dryRun: boolean): number | null {
  const raw = readValue(argv, '--max-batches');
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`Ugyldig --max-batches=${raw} (må være et heltall ≥ 1)`);
    }
    return parsed;
  }
  if (dryRun) {
    return 1;
  }
  return null;
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

  const dryRun = readFlag(argv, '--dry-run');
  const maxBatches = resolveMaxBatches(argv, dryRun);

  const embedHttpTimeoutMs = readPositiveIntMs(
    argv,
    '--embed-http-timeout-ms',
    'EMBED_BACKFILL_HTTP_TIMEOUT_MS',
    DEFAULT_EMBED_HTTP_TIMEOUT_MS,
    'embed HTTP timeout ms ≥ 1',
  );
  const dbRpcTimeoutMs = readPositiveIntMs(
    argv,
    '--db-rpc-timeout-ms',
    'EMBED_BACKFILL_DB_TIMEOUT_MS',
    DEFAULT_DB_RPC_TIMEOUT_MS,
    'DB RPC timeout ms ≥ 1',
  );
  const progressWatchdogMs = readPositiveIntMs(
    argv,
    '--progress-watchdog-ms',
    'EMBED_BACKFILL_PROGRESS_WATCHDOG_MS',
    DEFAULT_PROGRESS_WATCHDOG_MS,
    'progress watchdog ms ≥ 1',
  );

  return {
    provider,
    maxBatchesPerMin,
    fullMaxBatchesPerMin,
    fastLaneMinBatchesPerMin,
    maxBatches,
    dryRun,
    stopFile: readValue(argv, '--stop-file') ?? null,
    schedule: readValue(argv, '--schedule') ?? null,
    scheduleTimeZone: readValue(argv, '--schedule-tz') ?? 'Europe/Oslo',
    busyPause,
    busyLatencyMs,
    probeBeforeBatch: readFlag(argv, '--probe-before-batch'),
    preflightOnly: readFlag(argv, '--preflight-only'),
    leaseSeconds,
    embedHttpTimeoutMs,
    dbRpcTimeoutMs,
    progressWatchdogMs,
  };
}

export function loadScheduleWindows(cli: BackfillCli) {
  if (!cli.schedule) return [];
  return parseSchedule(cli.schedule);
}
