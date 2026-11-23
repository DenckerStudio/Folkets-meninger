'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/gate';
import { isAdminLocalAiHubEnabled } from '@/lib/admin/local-ai-hub/flags';
import { readLocalAiHubConfig } from '@/lib/admin/local-ai-hub/config';
import { rollupCi } from '@/lib/admin/local-ai-hub/ci-rollup';
import {
  fetchCiForSha,
  getPull,
  listPullComments,
  mergePullSquash,
} from '@/lib/admin/local-ai-hub/github-client';
import { LOCAL_AI_LABEL_TITLES } from '@/lib/admin/local-ai-hub/labels';
import { computeMergeEligibility } from '@/lib/admin/local-ai-hub/merge-eligibility';
import { parseVerdictsFromComments } from '@/lib/admin/local-ai-hub/verdict-parser';
import {
  listLabels,
  listProjectTasks,
  patchTaskDone,
  replaceLabelOnTask,
  setTaskLabelsBulk,
  taskHasLabel,
} from '@/lib/admin/local-ai-hub/vikunja-client';
import type { LocalAiApproveHubNotice } from '@/lib/admin/local-ai-hub/approve-hub-notice';
import {
  approveSuccessAfterPrReady,
  hubNoticeAfterRetry,
  markLinkedDraftPrReadyForReview,
} from '@/lib/admin/local-ai-hub/approve-pr-ready';
import { shortenUpstreamError } from '@/lib/admin/local-ai-hub/upstream-errors';
import { routes } from '@/lib/routes';

export type LocalAiActionResult =
  | { ok: true; hubNotice?: LocalAiApproveHubNotice }
  | { ok: false; error: string };

function requireLocalAiHubFlag(): LocalAiActionResult | { ok: true } {
  if (!isAdminLocalAiHubEnabled()) {
    return { ok: false, error: 'Lokal-AI-hub er ikke aktivert' };
  }
  return { ok: true };
}

async function requireConfig() {
  const config = readLocalAiHubConfig();
  if (!config.ok) {
    return { ok: false as const, error: `Mangler miljøvariabel: ${config.missing.join(', ')}` };
  }
  return { ok: true as const, config };
}

export async function approveLocalAiSuggestionAction(taskId: number): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  const vikunjaOpts = {
    apiUrl: cfg.config.apiUrl,
    apiToken: cfg.config.apiToken,
    projectId: cfg.config.projectId,
  };

  const [tasksRes, labelsRes] = await Promise.all([listProjectTasks(vikunjaOpts), listLabels(vikunjaOpts)]);
  if (!tasksRes.ok) return { ok: false, error: tasksRes.error };
  if (!labelsRes.ok) return { ok: false, error: labelsRes.error };

  const task = tasksRes.tasks.find((t) => t.id === taskId);
  if (!task || !taskHasLabel(task, LOCAL_AI_LABEL_TITLES.forslag)) {
    return { ok: false, error: 'Oppgaven finnes ikke eller er ikke et forslag' };
  }

  const labelMap = new Map(labelsRes.labels.map((l) => [l.title, l.id]));
  const queuedId = labelMap.get(LOCAL_AI_LABEL_TITLES.queued);
  if (!queuedId) {
    return { ok: false, error: `Mangler Vikunja-etikett «${LOCAL_AI_LABEL_TITLES.queued}»` };
  }

  const nextIds = replaceLabelOnTask(task, LOCAL_AI_LABEL_TITLES.forslag, queuedId, labelMap);
  const bulk = await setTaskLabelsBulk(vikunjaOpts, taskId, nextIds);
  if (!bulk.ok) return bulk;

  const prReady = await markLinkedDraftPrReadyForReview(
    {
      token: cfg.config.githubToken,
      owner: cfg.config.githubOwner,
      repo: cfg.config.githubRepo,
    },
    taskId,
    {
      title: task.title,
      description: task.description,
      comments: task.comments,
    },
  );

  revalidatePath(routes.adminOppgaver);
  return approveSuccessAfterPrReady(taskId, prReady);
}

export async function retryMarkLocalAiDraftPrReadyAction(taskId: number): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  const vikunjaOpts = {
    apiUrl: cfg.config.apiUrl,
    apiToken: cfg.config.apiToken,
    projectId: cfg.config.projectId,
  };

  const tasksRes = await listProjectTasks(vikunjaOpts);
  if (!tasksRes.ok) return { ok: false, error: tasksRes.error };

  const task = tasksRes.tasks.find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: 'Oppgaven finnes ikke' };
  }

  const prReady = await markLinkedDraftPrReadyForReview(
    {
      token: cfg.config.githubToken,
      owner: cfg.config.githubOwner,
      repo: cfg.config.githubRepo,
    },
    taskId,
    {
      title: task.title,
      description: task.description,
      comments: task.comments,
    },
  );

  revalidatePath(routes.adminOppgaver);

  const retry = hubNoticeAfterRetry(taskId, prReady);
  if (!retry.ok) return retry;
  return { ok: true, hubNotice: retry.hubNotice };
}

export async function rejectLocalAiSuggestionAction(taskId: number): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  const vikunjaOpts = {
    apiUrl: cfg.config.apiUrl,
    apiToken: cfg.config.apiToken,
    projectId: cfg.config.projectId,
  };

  const [tasksRes, labelsRes] = await Promise.all([listProjectTasks(vikunjaOpts), listLabels(vikunjaOpts)]);
  if (!tasksRes.ok) return { ok: false, error: tasksRes.error };
  if (!labelsRes.ok) return { ok: false, error: labelsRes.error };

  const task = tasksRes.tasks.find((t) => t.id === taskId);
  if (!task || !taskHasLabel(task, LOCAL_AI_LABEL_TITLES.forslag)) {
    return { ok: false, error: 'Oppgaven finnes ikke eller er ikke et forslag' };
  }

  const labelMap = new Map(labelsRes.labels.map((l) => [l.title, l.id]));
  const avvistId = labelMap.get(LOCAL_AI_LABEL_TITLES.avvist);
  if (!avvistId) {
    return { ok: false, error: `Mangler Vikunja-etikett «${LOCAL_AI_LABEL_TITLES.avvist}»` };
  }

  const nextIds = replaceLabelOnTask(task, LOCAL_AI_LABEL_TITLES.forslag, avvistId, labelMap);
  const bulk = await setTaskLabelsBulk(vikunjaOpts, taskId, nextIds);
  if (!bulk.ok) return bulk;

  const done = await patchTaskDone(vikunjaOpts, taskId, true);
  if (!done.ok) return done;

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}

export async function mergeLocalAiPullAction(input: {
  owner: string;
  repo: string;
  number: number;
  expectedHeadSha: string;
}): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  if (
    input.owner !== cfg.config.githubOwner ||
    input.repo !== cfg.config.githubRepo
  ) {
    return { ok: false, error: 'Ugyldig repository for merge' };
  }

  const gh = {
    token: cfg.config.githubToken,
    owner: input.owner,
    repo: input.repo,
  };

  const pullRes = await getPull(gh, input.number);
  if (!pullRes.ok) return { ok: false, error: pullRes.error };
  const pull = pullRes.pull;

  if (pull.head.sha !== input.expectedHeadSha) {
    return { ok: false, error: 'Head-SHA har endret seg — last siden på nytt' };
  }

  const [ciRes, commentsRes] = await Promise.all([
    fetchCiForSha(gh, pull.head.sha),
    listPullComments(gh, pull.number),
  ]);

  const ci = ciRes.ok ? rollupCi(ciRes) : null;
  const verdicts =
    commentsRes.ok
      ? parseVerdictsFromComments(
          commentsRes.comments.map((c) => ({
            body: c.body ?? '',
            created_at: c.created_at,
            author_association: c.author_association,
          })),
          pull.head.sha,
        )
      : { pixel: 'unknown' as const, friction: 'unknown' as const };

  const elig = computeMergeEligibility({
    pull,
    ci,
    pixel: verdicts.pixel,
    friction: verdicts.friction,
  });
  if (!elig.canMerge) {
    return { ok: false, error: elig.reasons.join(' · ') || 'Merge er ikke tillatt' };
  }

  const merged = await mergePullSquash(gh, pull.number, pull.head.sha);
  if (!merged.ok) {
    return { ok: false, error: shortenUpstreamError(merged.error, 'Merge feilet') };
  }

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}

export async function requeueFailedLocalAiTaskAction(taskId: number): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  const vikunjaOpts = {
    apiUrl: cfg.config.apiUrl,
    apiToken: cfg.config.apiToken,
    projectId: cfg.config.projectId,
  };

  const [tasksRes, labelsRes] = await Promise.all([listProjectTasks(vikunjaOpts), listLabels(vikunjaOpts)]);
  if (!tasksRes.ok) {
    return { ok: false, error: shortenUpstreamError(tasksRes.error, 'Kunne ikke hente oppgaver') };
  }
  if (!labelsRes.ok) {
    return { ok: false, error: shortenUpstreamError(labelsRes.error, 'Kunne ikke hente etiketter') };
  }

  const task = tasksRes.tasks.find((t) => t.id === taskId);
  if (!task || !taskHasLabel(task, LOCAL_AI_LABEL_TITLES.feilet)) {
    return { ok: false, error: 'Oppgaven finnes ikke eller er ikke merket som feilet' };
  }

  const labelMap = new Map(labelsRes.labels.map((l) => [l.title, l.id]));
  const queuedId = labelMap.get(LOCAL_AI_LABEL_TITLES.queued);
  if (!queuedId) {
    return { ok: false, error: `Mangler Vikunja-etikett «${LOCAL_AI_LABEL_TITLES.queued}»` };
  }

  const nextIds = replaceLabelOnTask(task, LOCAL_AI_LABEL_TITLES.feilet, queuedId, labelMap);
  const bulk = await setTaskLabelsBulk(vikunjaOpts, taskId, nextIds);
  if (!bulk.ok) {
    return { ok: false, error: shortenUpstreamError(bulk.error, 'Kunne ikke oppdatere etiketter') };
  }

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}

export async function rejectFailedLocalAiTaskAction(taskId: number): Promise<LocalAiActionResult> {
  const flag = requireLocalAiHubFlag();
  if (!flag.ok) return flag;

  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const cfg = await requireConfig();
  if (!cfg.ok) return cfg;

  const vikunjaOpts = {
    apiUrl: cfg.config.apiUrl,
    apiToken: cfg.config.apiToken,
    projectId: cfg.config.projectId,
  };

  const [tasksRes, labelsRes] = await Promise.all([listProjectTasks(vikunjaOpts), listLabels(vikunjaOpts)]);
  if (!tasksRes.ok) {
    return { ok: false, error: shortenUpstreamError(tasksRes.error, 'Kunne ikke hente oppgaver') };
  }
  if (!labelsRes.ok) {
    return { ok: false, error: shortenUpstreamError(labelsRes.error, 'Kunne ikke hente etiketter') };
  }

  const task = tasksRes.tasks.find((t) => t.id === taskId);
  if (!task || !taskHasLabel(task, LOCAL_AI_LABEL_TITLES.feilet)) {
    return { ok: false, error: 'Oppgaven finnes ikke eller er ikke merket som feilet' };
  }

  const labelMap = new Map(labelsRes.labels.map((l) => [l.title, l.id]));
  const avvistId = labelMap.get(LOCAL_AI_LABEL_TITLES.avvist);
  if (!avvistId) {
    return { ok: false, error: `Mangler Vikunja-etikett «${LOCAL_AI_LABEL_TITLES.avvist}»` };
  }

  const nextIds = replaceLabelOnTask(task, LOCAL_AI_LABEL_TITLES.feilet, avvistId, labelMap);
  const bulk = await setTaskLabelsBulk(vikunjaOpts, taskId, nextIds);
  if (!bulk.ok) {
    return { ok: false, error: shortenUpstreamError(bulk.error, 'Kunne ikke oppdatere etiketter') };
  }

  const done = await patchTaskDone(vikunjaOpts, taskId, true);
  if (!done.ok) {
    return { ok: false, error: shortenUpstreamError(done.error, 'Kunne ikke markere oppgave som ferdig') };
  }

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}