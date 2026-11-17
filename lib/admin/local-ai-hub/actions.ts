'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/gate';
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
import { routes } from '@/lib/routes';

export type LocalAiActionResult = { ok: true } | { ok: false; error: string };

async function requireConfig() {
  const config = readLocalAiHubConfig();
  if (!config.ok) {
    return { ok: false as const, error: `Mangler miljøvariabel: ${config.missing.join(', ')}` };
  }
  return { ok: true as const, config };
}

export async function approveLocalAiSuggestionAction(taskId: number): Promise<LocalAiActionResult> {
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

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}

export async function rejectLocalAiSuggestionAction(taskId: number): Promise<LocalAiActionResult> {
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
          commentsRes.comments.map((c) => ({ body: c.body ?? '', created_at: c.created_at })),
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
  if (!merged.ok) return { ok: false, error: merged.error };

  revalidatePath(routes.adminOppgaver);
  return { ok: true };
}