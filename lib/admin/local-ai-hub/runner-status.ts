/** Tidsgrense: «running» med for gammel updated_at behandles som utilgjengelig. */
export const RUNNER_STATUS_STALE_RUNNING_MS = 15 * 60 * 1000;

export const LOCAL_AI_RUNNER_STATUS_FETCH_TIMEOUT_MS = 2_000;

export const RUNNER_STEPS = ['plukker', 'koder', 'self-check', 'pusher'] as const;
export type RunnerStep = (typeof RUNNER_STEPS)[number];

export const RUNNER_STATES = ['idle', 'paused', 'running'] as const;
export type RunnerState = (typeof RUNNER_STATES)[number];

export type RunnerStatusTask = { id: number; title: string };
export type RunnerStatusPr = { number: number; url: string };

export type RunnerStatusPayload = {
  updated_at: string;
  state: RunnerState;
  pause_until: string | null;
  step: RunnerStep | null;
  task: RunnerStatusTask | null;
  branch: string | null;
  pr: RunnerStatusPr | null;
  model: string | null;
  tok_s: number | null;
  last_run_at: string | null;
};

export type LocalAiRunnerStatusView = {
  available: true;
  statusLabel: string;
  state: RunnerState;
  pauseUntil: string | null;
  step: RunnerStep | null;
  task: RunnerStatusTask | null;
  branch: string | null;
  pr: RunnerStatusPr | null;
  model: string | null;
  tokSLabel: string | null;
  lastRunAtLabel: string | null;
};

export type LocalAiRunnerStatusResult = LocalAiRunnerStatusView | { available: false };

function isRunnerState(value: unknown): value is RunnerState {
  return typeof value === 'string' && (RUNNER_STATES as readonly string[]).includes(value);
}

function isRunnerStep(value: unknown): value is RunnerStep {
  return typeof value === 'string' && (RUNNER_STEPS as readonly string[]).includes(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readTask(value: unknown): RunnerStatusTask | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const id = typeof rec.id === 'number' && Number.isFinite(rec.id) ? rec.id : null;
  const title = readOptionalString(rec.title);
  if (id === null || !title) return null;
  return { id, title };
}

function readPr(value: unknown): RunnerStatusPr | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const number =
    typeof rec.number === 'number' && Number.isFinite(rec.number) ? rec.number : null;
  const url = readOptionalString(rec.url);
  if (number === null || !url) return null;
  return { number, url };
}

function readTokS(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function formatRunnerTokS(tokS: number): string {
  const rounded = Math.round(tokS * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
  return `${display} tok/s`;
}

export function formatRunnerOsloDateTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pauseStatusLabel(pauseUntil: string | null): string {
  if (pauseUntil && /^\d{1,2}:\d{2}$/.test(pauseUntil)) {
    return `Pause til ${pauseUntil}`;
  }
  return 'Pause';
}

export function isRunnerStatusStaleRunning(
  payload: Pick<RunnerStatusPayload, 'state' | 'updated_at'>,
  nowMs = Date.now(),
): boolean {
  if (payload.state !== 'running') return false;
  const updated = new Date(payload.updated_at);
  if (Number.isNaN(updated.getTime())) return true;
  return nowMs - updated.getTime() > RUNNER_STATUS_STALE_RUNNING_MS;
}

export function parseRunnerStatusPayload(raw: unknown): RunnerStatusPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;

  const updatedAt = readOptionalString(rec.updated_at);
  if (!updatedAt) return null;
  if (!isRunnerState(rec.state)) return null;

  const pauseUntil = readOptionalString(rec.pause_until);
  let step: RunnerStep | null = null;
  if (rec.step !== undefined && rec.step !== null) {
    if (!isRunnerStep(rec.step)) return null;
    step = rec.step;
  }

  return {
    updated_at: updatedAt,
    state: rec.state,
    pause_until: pauseUntil,
    step,
    task: readTask(rec.task),
    branch: readOptionalString(rec.branch),
    pr: readPr(rec.pr),
    model: readOptionalString(rec.model),
    tok_s: readTokS(rec.tok_s),
    last_run_at: readOptionalString(rec.last_run_at),
  };
}

export function mapRunnerStatusToView(
  payload: RunnerStatusPayload,
  nowMs = Date.now(),
): LocalAiRunnerStatusResult {
  if (isRunnerStatusStaleRunning(payload, nowMs)) {
    return { available: false };
  }

  let statusLabel: string;
  switch (payload.state) {
    case 'idle':
      statusLabel = 'Ledig';
      break;
    case 'paused':
      statusLabel = pauseStatusLabel(payload.pause_until);
      break;
    case 'running':
      statusLabel =
        payload.task !== null
          ? `#${payload.task.id} ${payload.task.title}`
          : 'Kjører';
      break;
    default: {
      const _exhaustive: never = payload.state;
      void _exhaustive;
      return { available: false };
    }
  }

  return {
    available: true,
    statusLabel,
    state: payload.state,
    pauseUntil: payload.pause_until,
    step: payload.state === 'running' ? payload.step : null,
    task: payload.state === 'running' ? payload.task : null,
    branch: payload.state === 'running' ? payload.branch : null,
    pr: payload.state === 'running' ? payload.pr : null,
    model: payload.model,
    tokSLabel: payload.tok_s !== null ? formatRunnerTokS(payload.tok_s) : null,
    lastRunAtLabel:
      payload.last_run_at !== null ? formatRunnerOsloDateTime(payload.last_run_at) : null,
  };
}

export function parseAndMapRunnerStatus(
  raw: unknown,
  nowMs = Date.now(),
): LocalAiRunnerStatusResult {
  const payload = parseRunnerStatusPayload(raw);
  if (!payload) return { available: false };
  return mapRunnerStatusToView(payload, nowMs);
}

/** Sikrer at API-svaret ikke kan lekke intern runner-URL eller rå feilmeldinger. */
export function serializeRunnerStatusForClient(
  result: LocalAiRunnerStatusResult,
): LocalAiRunnerStatusResult {
  return result;
}

export async function fetchRunnerStatusFromUrl(
  statusUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<LocalAiRunnerStatusResult> {
  try {
    const res = await fetchFn(statusUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LOCAL_AI_RUNNER_STATUS_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { available: false };
    }
    const raw: unknown = await res.json();
    return serializeRunnerStatusForClient(parseAndMapRunnerStatus(raw));
  } catch {
    return { available: false };
  }
}