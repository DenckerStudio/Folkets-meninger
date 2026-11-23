import {
  findPullByBranch,
  getPull,
  LOCAL_AI_APPROVE_PR_READY_COMMENT,
  markPullRequestReadyForReview,
  postIssueComment,
  type GithubPull,
} from '@/lib/admin/local-ai-hub/github-http';
import { LOCAL_AI_BRANCH_PREFIX, LOCAL_AI_GITHUB_REPO } from '@/lib/admin/local-ai-hub/labels';
import { collectTaskTextParts, resolvePrLinkFromTask } from '@/lib/admin/local-ai-hub/pr-link';
import {
  buildApproveHubNotice,
  type LocalAiApproveHubNotice,
} from '@/lib/admin/local-ai-hub/approve-hub-notice';
import type {
  MarkLinkedDraftPrReadyPull,
  MarkLinkedDraftPrReadyResult,
} from '@/lib/admin/local-ai-hub/approve-pr-ready-result';

export type { MarkLinkedDraftPrReadyPull, MarkLinkedDraftPrReadyResult };

const LOCAL_AI_HEAD_BRANCH_PREFIX = 'lokal-ai/';

type GithubOpts = { token: string; owner: string; repo: string };

function pullMeta(pull: GithubPull): MarkLinkedDraftPrReadyPull {
  return { number: pull.number, url: pull.html_url };
}

function isTargetRepo(owner: string, repo: string): boolean {
  return owner === LOCAL_AI_GITHUB_REPO.owner && repo === LOCAL_AI_GITHUB_REPO.repo;
}

function shouldMarkDraftPrReady(pull: GithubPull): boolean {
  if (pull.state !== 'open' || pull.merged) return false;
  if (!pull.draft) return false;
  if (!pull.head.ref.startsWith(LOCAL_AI_HEAD_BRANCH_PREFIX)) return false;
  return true;
}

type ResolveOpenPullResult =
  | { kind: 'pull'; pull: GithubPull }
  | { kind: 'skip' }
  | { kind: 'error'; error: string };

async function resolveOpenPull(
  gh: GithubOpts,
  taskId: number,
  text: string,
): Promise<ResolveOpenPullResult> {
  const link = resolvePrLinkFromTask(taskId, text);
  if (!link || !isTargetRepo(link.owner, link.repo)) {
    return { kind: 'skip' };
  }

  let pull: GithubPull | null = null;

  if (link.mode === 'branch' && link.branch) {
    if (!link.branch.startsWith(LOCAL_AI_BRANCH_PREFIX)) {
      return { kind: 'skip' };
    }
    const found = await findPullByBranch(gh, link.branch);
    if (!found.ok) return { kind: 'error', error: found.error };
    pull = found.pull;
    if (!pull) return { kind: 'skip' };
  } else if (link.number) {
    const got = await getPull(gh, link.number);
    if (!got.ok) return { kind: 'error', error: got.error };
    pull = got.pull;
  } else {
    return { kind: 'skip' };
  }

  if (!shouldMarkDraftPrReady(pull)) {
    return { kind: 'skip' };
  }

  return { kind: 'pull', pull };
}

export async function markLinkedDraftPrReadyForReview(
  gh: GithubOpts,
  taskId: number,
  taskParts: { description?: string | null; title?: string | null; comments?: { comment: string }[] | null },
): Promise<MarkLinkedDraftPrReadyResult> {
  const text = collectTaskTextParts(taskParts);
  const resolved = await resolveOpenPull(gh, taskId, text);
  if (resolved.kind === 'skip') return { ok: false, skipped: true };
  if (resolved.kind === 'error') return { ok: false, error: resolved.error };

  const { pull } = resolved;
  const meta = pullMeta(pull);
  const nodeId = pull.node_id;
  if (!nodeId) {
    return { ok: false, error: 'Pull request mangler node_id fra GitHub' };
  }

  const ready = await markPullRequestReadyForReview(gh, nodeId);
  if (!ready.ok) {
    return { ok: false, readyFailed: true, pull: meta, error: ready.error };
  }

  const comment = await postIssueComment(gh, pull.number, LOCAL_AI_APPROVE_PR_READY_COMMENT);
  if (!comment.ok) {
    return { ok: true, pull: meta, commentFailed: true };
  }

  return { ok: true, pull: meta };
}

export function approveSuccessAfterPrReady(
  taskId: number,
  prReady: MarkLinkedDraftPrReadyResult,
): { ok: true; hubNotice?: LocalAiApproveHubNotice } {
  const hubNotice = buildApproveHubNotice(taskId, prReady);
  return hubNotice ? { ok: true, hubNotice } : { ok: true };
}

export function hubNoticeAfterRetry(
  taskId: number,
  prReady: MarkLinkedDraftPrReadyResult,
): { ok: true; hubNotice: LocalAiApproveHubNotice } | { ok: false; error: string } {
  if ('skipped' in prReady && prReady.skipped) {
    return { ok: false, error: 'Ingen draft-PR å sette ready – den kan allerede være klar.' };
  }
  const hubNotice = buildApproveHubNotice(taskId, prReady);
  if (!hubNotice) {
    return { ok: false, error: 'Kunne ikke sette PR til ready.' };
  }
  return { ok: true, hubNotice };
}