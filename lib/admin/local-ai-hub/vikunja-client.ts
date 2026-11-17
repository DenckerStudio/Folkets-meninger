import 'server-only';

import { LOCAL_AI_FETCH_TIMEOUT_MS, LOCAL_AI_LABEL_TITLES } from '@/lib/admin/local-ai-hub/labels';

const MAX_TASK_PAGES = 30;
const TASKS_PER_PAGE = 50;

export type VikunjaLabel = { id: number; title: string };

export type VikunjaComment = { id: number; comment: string; created: string };

export type VikunjaTask = {
  id: number;
  title: string;
  description: string;
  done: boolean;
  labels?: VikunjaLabel[];
  comments?: VikunjaComment[];
};

type VikunjaClientOptions = {
  apiUrl: string;
  apiToken: string;
  projectId: number;
};

const LOCAL_AI_LABEL_SET = new Set<string>(Object.values(LOCAL_AI_LABEL_TITLES));

function normalizeBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
}

async function vikunjaFetch<T>(
  opts: VikunjaClientOptions,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const base = normalizeBaseUrl(opts.apiUrl);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${opts.apiToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        error: text || `Vikunja svarte med HTTP ${res.status}`,
        status: res.status,
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    return { ok: false, error: msg };
  }
}

function taskHasLocalAiLabel(task: VikunjaTask): boolean {
  return (task.labels ?? []).some((l) => LOCAL_AI_LABEL_SET.has(l.title));
}

export async function listProjectTasks(
  opts: VikunjaClientOptions,
): Promise<{ ok: true; tasks: VikunjaTask[] } | { ok: false; error: string }> {
  const collected: VikunjaTask[] = [];

  for (let page = 1; page <= MAX_TASK_PAGES; page += 1) {
    const result = await vikunjaFetch<VikunjaTask[] | { tasks?: VikunjaTask[] }>(
      opts,
      `/projects/${opts.projectId}/tasks?per_page=${TASKS_PER_PAGE}&page=${page}&expand=comments`,
      { method: 'GET' },
    );
    if (!result.ok) {
      return page === 1 ? result : { ok: true, tasks: collected };
    }
    const raw = result.data;
    const batch = Array.isArray(raw) ? raw : Array.isArray(raw.tasks) ? raw.tasks : [];
    if (batch.length === 0) {
      break;
    }
    for (const task of batch) {
      if (taskHasLocalAiLabel(task)) {
        collected.push(task);
      }
    }
    if (batch.length < TASKS_PER_PAGE) {
      break;
    }
  }

  return { ok: true, tasks: collected };
}

export async function listLabels(
  opts: VikunjaClientOptions,
): Promise<{ ok: true; labels: VikunjaLabel[] } | { ok: false; error: string }> {
  const result = await vikunjaFetch<VikunjaLabel[]>(opts, '/labels', { method: 'GET' });
  if (!result.ok) return result;
  return { ok: true, labels: Array.isArray(result.data) ? result.data : [] };
}

export async function setTaskLabelsBulk(
  opts: VikunjaClientOptions,
  taskId: number,
  labelIds: number[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await vikunjaFetch<unknown>(opts, `/tasks/${taskId}/labels/bulk`, {
    method: 'POST',
    body: JSON.stringify({ labels: labelIds.map((id) => ({ id })) }),
  });
  if (!result.ok) return result;
  return { ok: true };
}

export async function patchTaskDone(
  opts: VikunjaClientOptions,
  taskId: number,
  done: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await vikunjaFetch<unknown>(opts, `/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ done }),
  });
  if (!result.ok) return result;
  return { ok: true };
}

export function taskHasLabel(task: VikunjaTask, title: string): boolean {
  return (task.labels ?? []).some((l) => l.title === title);
}

export function replaceLabelOnTask(
  task: VikunjaTask,
  fromTitle: string,
  toLabelId: number,
  _allLabelsByTitle: Map<string, number>,
): number[] {
  const keep = new Set<number>();
  for (const l of task.labels ?? []) {
    if (l.title === fromTitle) continue;
    keep.add(l.id);
  }
  keep.add(toLabelId);
  return [...keep];
}