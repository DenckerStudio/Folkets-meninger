import 'server-only';

import { readLocalAiHubConfig, type LocalAiHubConfig } from '@/lib/admin/local-ai-hub/config';
import { rollupCi, type CiRollup } from '@/lib/admin/local-ai-hub/ci-rollup';
import {
  fetchCiForSha,
  findPullByBranch,
  getPull,
  listPullComments,
  type GithubPull,
} from '@/lib/admin/local-ai-hub/github-client';
import { LOCAL_AI_LABEL_TITLES } from '@/lib/admin/local-ai-hub/labels';
import { computeMergeEligibility, type MergeEligibility } from '@/lib/admin/local-ai-hub/merge-eligibility';
import { collectTaskTextParts, resolvePrLinkFromTask } from '@/lib/admin/local-ai-hub/pr-link';
import { parseVerdictsFromComments, type ReviewVerdictOutcome } from '@/lib/admin/local-ai-hub/verdict-parser';
import { listProjectTasks, type VikunjaTask } from '@/lib/admin/local-ai-hub/vikunja-client';
import {
  mergeInactiveFinishedRowFromCache,
  readInactiveFinishedRowCache,
  writeInactiveFinishedRowCache,
} from '@/lib/admin/local-ai-hub/inactive-finished-row-cache';
import { shouldSkipPullGithubEnrichment } from '@/lib/admin/local-ai-hub/pull-enrichment';
import { shortenUpstreamError } from '@/lib/admin/local-ai-hub/upstream-errors';

export type {
  LocalAiFinishedRow,
  LocalAiOverviewResult,
  LocalAiSuggestionRow,
} from '@/lib/admin/local-ai-hub/overview-types';
import type {
  LocalAiFinishedRow,
  LocalAiOverviewResult,
  LocalAiSuggestionRow,
} from '@/lib/admin/local-ai-hub/overview-types';

async function enrichPullRow(
  config: Extract<LocalAiHubConfig, { ok: true }>,
  task: VikunjaTask,
  failed: boolean,
): Promise<LocalAiFinishedRow> {
  const text = collectTaskTextParts({
    title: task.title,
    description: task.description,
    comments: task.comments,
  });
  const failureComment =
    failed && task.comments?.length
      ? [...task.comments].sort((a, b) => Date.parse(b.created) - Date.parse(a.created))[0]?.comment ??
        null
      : null;

  const base: LocalAiFinishedRow = {
    taskId: task.id,
    title: task.title,
    failed,
    failureComment,
    pr: null,
    prError: null,
    ci: null,
    ciError: null,
    pixel: 'unknown',
    friction: 'unknown',
    merge: { canMerge: false, reasons: ['Fant ingen tilknyttet pull request'] },
  };

  const link = resolvePrLinkFromTask(task.id, text);
  if (!link) {
    base.prError = 'Fant ingen branch eller PR-lenke i oppgaven';
    return base;
  }

  const inactiveCached = readInactiveFinishedRowCache(task.id, link);
  if (inactiveCached) {
    return mergeInactiveFinishedRowFromCache(inactiveCached, task, failed, failureComment);
  }

  let pull: GithubPull | null = null;
  let prError: string | null = null;

  if (link.mode === 'branch' && link.branch) {
    const found = await findPullByBranch(
      {
        token: config.githubToken,
        owner: link.owner,
        repo: link.repo,
      },
      link.branch,
    );
    if (!found.ok) {
      prError = found.error;
    } else {
      pull = found.pull;
      if (!pull) prError = `Fant ingen PR for branch ${link.branch}`;
    }
  } else if (link.number) {
    const got = await getPull(
      { token: config.githubToken, owner: link.owner, repo: link.repo },
      link.number,
    );
    if (!got.ok) prError = got.error;
    else pull = got.pull;
  }

  if (!pull) {
    base.prError = prError
      ? shortenUpstreamError(prError, 'Kunne ikke hente pull request')
      : 'Kunne ikke hente pull request';
    return base;
  }

  base.pr = {
    number: pull.number,
    url: pull.html_url,
    state: pull.state,
    merged: pull.merged,
    headSha: pull.head.sha,
    headRef: pull.head.ref,
    mergeable: pull.mergeable,
  };

  let ci: CiRollup | null = null;
  let ciError: string | null = null;
  let pixel: ReviewVerdictOutcome = 'unknown';
  let friction: ReviewVerdictOutcome = 'unknown';

  if (shouldSkipPullGithubEnrichment(pull)) {
    base.ci = ci;
    base.ciError = ciError;
    base.pixel = pixel;
    base.friction = friction;
    base.merge = computeMergeEligibility({ pull, ci, pixel, friction });
    writeInactiveFinishedRowCache(task.id, link, base);
    return base;
  }

  const ghOpts = { token: config.githubToken, owner: link.owner, repo: link.repo };
  const [ciSettled, commentsSettled] = await Promise.allSettled([
    fetchCiForSha(ghOpts, pull.head.sha),
    listPullComments(ghOpts, pull.number),
  ]);

  if (ciSettled.status === 'fulfilled') {
    if (ciSettled.value.ok) {
      ci = rollupCi(ciSettled.value);
    } else {
      ciError = shortenUpstreamError(ciSettled.value.error, 'Kunne ikke hente CI-status');
    }
  } else {
    ciError = 'Kunne ikke hente CI-status';
  }
  base.ci = ci;
  base.ciError = ciError;

  if (commentsSettled.status === 'fulfilled' && commentsSettled.value.ok) {
    const parsed = parseVerdictsFromComments(
      commentsSettled.value.comments.map((c) => ({
        body: c.body ?? '',
        created_at: c.created_at,
        author_association: c.author_association,
      })),
      pull.head.sha,
    );
    pixel = parsed.pixel;
    friction = parsed.friction;
  }

  base.pixel = pixel;
  base.friction = friction;
  base.merge = computeMergeEligibility({ pull, ci, pixel, friction });
  return base;
}

export async function loadLocalAiOverview(): Promise<LocalAiOverviewResult> {
  const config = readLocalAiHubConfig();
  if (!config.ok) {
    return { ok: false, kind: 'config', missing: config.missing };
  }

  const tasksRes = await listProjectTasks({
    apiUrl: config.apiUrl,
    apiToken: config.apiToken,
    projectId: config.projectId,
  });

  if (!tasksRes.ok) {
    return {
      ok: true,
      ferdig: [],
      forslag: [],
      partialErrors: [shortenUpstreamError(tasksRes.error, 'Kunne ikke hente Vikunja-oppgaver')],
    };
  }

  const ferdigTasks: VikunjaTask[] = [];
  const forslagTasks: VikunjaTask[] = [];

  for (const t of tasksRes.tasks) {
    const hasPr = (t.labels ?? []).some((l) => l.title === LOCAL_AI_LABEL_TITLES.pr);
    const hasFailed = (t.labels ?? []).some((l) => l.title === LOCAL_AI_LABEL_TITLES.feilet);
    const hasForslag = (t.labels ?? []).some((l) => l.title === LOCAL_AI_LABEL_TITLES.forslag);

    if (hasPr || hasFailed) ferdigTasks.push(t);
    if (hasForslag) forslagTasks.push(t);
  }

  const enriched = await Promise.allSettled(
    ferdigTasks.map((t) =>
      enrichPullRow(
        config,
        t,
        (t.labels ?? []).some((l) => l.title === LOCAL_AI_LABEL_TITLES.feilet),
      ),
    ),
  );

  const ferdig: LocalAiFinishedRow[] = [];
  const partialErrors: string[] = [];

  for (const row of enriched) {
    if (row.status === 'fulfilled') {
      ferdig.push(row.value);
    } else {
      partialErrors.push('Kunne ikke laste én ferdig oppgave');
    }
  }

  const forslag: LocalAiSuggestionRow[] = forslagTasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    description: t.description ?? '',
  }));

  return { ok: true, ferdig, forslag, partialErrors };
}