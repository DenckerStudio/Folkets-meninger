import { LOCAL_AI_GITHUB_REPO } from '@/lib/admin/local-ai-hub/labels';

/** Tidsgrense: «running» med for gammel updated_at behandles som utilgjengelig. */
export const RUNNER_STATUS_STALE_RUNNING_MS = 15 * 60 * 1000;

export const RUNNER_TASK_TITLE_MAX_LENGTH = 200;

/** Må matche lokal-ai-runner-grener (samme prefiks som overview). */
export const LOCAL_AI_RUNNER_BRANCH_RE = /^lokal-ai\/vikunja-\d+-[a-z0-9-]+$/;

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
  /** Kun tall fra payload; URL bygges ved mapping. */
  prNumber: number | null;
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

export function truncateRunnerTaskTitle(title: string): string {
  if (title.length <= RUNNER_TASK_TITLE_MAX_LENGTH) return title;
  return `${title.slice(0, RUNNER_TASK_TITLE_MAX_LENGTH - 1)}…`;
}

export function buildLocalAiRunnerPrUrl(number: number): string {
  const { owner, repo } = LOCAL_AI_GITHUB_REPO;
  return `https://github.com/${owner}/${repo}/pull/${number}`;
}

function readTask(value: unknown): RunnerStatusTask | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const id =
    typeof rec.id === 'number' && Number.isInteger(rec.id) && rec.id > 0 ? rec.id : null;
  const title = readOptionalString(rec.title);
  if (id === null || !title) return null;
  return { id, title: truncateRunnerTaskTitle(title) };
}

function readPrNumber(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  const number =
    typeof rec.number === 'number' && Number.isInteger(rec.number) && rec.number > 0
      ? rec.number
      : null;
  return number;
}

function readRunnerBranch(value: unknown): string | null {
  const branch = readOptionalString(value);
  if (!branch || !LOCAL_AI_RUNNER_BRANCH_RE.test(branch)) return null;
  return branch;
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
    branch: readRunnerBranch(rec.branch),
    prNumber: readPrNumber(rec.pr),
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
    pr:
      payload.state === 'running' && payload.prNumber !== null
        ? {
            number: payload.prNumber,
            url: buildLocalAiRunnerPrUrl(payload.prNumber),
          }
        : null,
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

/** Whitelist: kun view-model-felter til admin-API / klient — ingen rå upstream-data. */
export function serializeRunnerStatusForClient(
  result: LocalAiRunnerStatusResult,
): LocalAiRunnerStatusResult {
  if (!result.available) {
    return { available: false };
  }
  return {
    available: true,
    statusLabel: result.statusLabel,
    state: result.state,
    pauseUntil: result.pauseUntil,
    step: result.step,
    task: result.task ? { id: result.task.id, title: result.task.title } : null,
    branch: result.branch,
    pr: result.pr ? { number: result.pr.number, url: result.pr.url } : null,
    model: result.model,
    tokSLabel: result.tokSLabel,
    lastRunAtLabel: result.lastRunAtLabel,
  };
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
