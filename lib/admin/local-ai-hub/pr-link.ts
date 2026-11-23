import { LOCAL_AI_BRANCH_PREFIX, LOCAL_AI_GITHUB_REPO } from '@/lib/admin/local-ai-hub/labels';

const PR_URL_RE =
  /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/gi;

export type ResolvedPrLink = {
  url: string;
  owner: string;
  repo: string;
  number: number;
};

export function expectedBranchPrefix(taskId: number | string): string {
  return `${LOCAL_AI_BRANCH_PREFIX}${taskId}-`;
}

export function collectTaskTextParts(parts: {
  description?: string | null;
  title?: string | null;
  comments?: { comment: string }[] | null;
}): string {
  const chunks: string[] = [];
  if (parts.title) chunks.push(parts.title);
  if (parts.description) chunks.push(parts.description);
  for (const c of parts.comments ?? []) {
    if (c.comment) chunks.push(c.comment);
  }
  return chunks.join('\n');
}

export function findBranchInTaskText(taskId: number, text: string): string | null {
  const prefix = expectedBranchPrefix(taskId);
  const branchRe = new RegExp(
    `${LOCAL_AI_BRANCH_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${taskId}-[a-z0-9-]+`,
    'i',
  );
  const match = branchRe.exec(text);
  return match?.[0] ?? (text.includes(prefix) ? extractLooseBranch(text, prefix) : null);
}

function extractLooseBranch(text: string, prefix: string): string | null {
  const idx = text.indexOf(prefix);
  if (idx < 0) return null;
  const tail = text.slice(idx);
  const m = /^[\w./-]+/.exec(tail);
  return m?.[0] ?? null;
}

export function findPrUrlInText(text: string): ResolvedPrLink | null {
  PR_URL_RE.lastIndex = 0;
  const m = PR_URL_RE.exec(text);
  if (!m) return null;
  return {
    url: m[0],
    owner: m[1],
    repo: m[2],
    number: Number.parseInt(m[3], 10),
  };
}

export type ResolvedTaskPrLink = {
  mode: 'branch' | 'url';
  branch?: string;
  owner: string;
  repo: string;
  number?: number;
  url?: string;
};

export function resolvePrLinkFromTask(taskId: number, text: string): ResolvedTaskPrLink | null {
  const branch = findBranchInTaskText(taskId, text);
  if (branch) {
    return {
      mode: 'branch',
      branch,
      owner: LOCAL_AI_GITHUB_REPO.owner,
      repo: LOCAL_AI_GITHUB_REPO.repo,
    };
  }
  const urlHit = findPrUrlInText(text);
  if (urlHit) {
    return {
      mode: 'url',
      url: urlHit.url,
      owner: urlHit.owner,
      repo: urlHit.repo,
      number: urlHit.number,
    };
  }
  return null;
}