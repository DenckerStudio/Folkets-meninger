import 'server-only';

import { parseGithubLinkNext } from '@/lib/admin/local-ai-hub/github-link';
import { LOCAL_AI_FETCH_TIMEOUT_MS } from '@/lib/admin/local-ai-hub/labels';

const MAX_ISSUE_COMMENT_PAGES = 10;

type GithubClientOptions = {
  token: string;
  owner: string;
  repo: string;
};

export type GithubPull = {
  number: number;
  html_url: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft?: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  head: { ref: string; sha: string };
};

export type GithubIssueComment = {
  id: number;
  body: string | null;
  created_at: string;
  author_association?: string | null;
  user?: { login?: string } | null;
};

async function githubFetch<T>(
  opts: GithubClientOptions,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const url = path.startsWith('https://')
    ? path
    : `https://api.github.com${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || `GitHub svarte med HTTP ${res.status}`, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    return { ok: false, error: msg };
  }
}

export async function findPullByBranch(
  opts: GithubClientOptions,
  branch: string,
): Promise<{ ok: true; pull: GithubPull | null } | { ok: false; error: string }> {
  const head = `${opts.owner}:${branch}`;
  const result = await githubFetch<GithubPull[]>(
    opts,
    `/repos/${opts.owner}/${opts.repo}/pulls?state=all&head=${encodeURIComponent(head)}&per_page=5`,
    { method: 'GET' },
  );
  if (!result.ok) return result;
  const pull = result.data.find((p) => p.head?.ref === branch) ?? result.data[0] ?? null;
  return { ok: true, pull: pull ?? null };
}

export async function getPull(
  opts: GithubClientOptions,
  number: number,
): Promise<{ ok: true; pull: GithubPull } | { ok: false; error: string }> {
  const result = await githubFetch<GithubPull>(
    opts,
    `/repos/${opts.owner}/${opts.repo}/pulls/${number}`,
    { method: 'GET' },
  );
  if (!result.ok) return result;
  return { ok: true, pull: result.data };
}

export async function listPullComments(
  opts: GithubClientOptions,
  number: number,
): Promise<{ ok: true; comments: GithubIssueComment[] } | { ok: false; error: string }> {
  const comments: GithubIssueComment[] = [];
  let url: string | null =
    `https://api.github.com/repos/${opts.owner}/${opts.repo}/issues/${number}/comments?per_page=100`;
  let pages = 0;

  try {
    while (url && pages < MAX_ISSUE_COMMENT_PAGES) {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          ok: false,
          error: text || `GitHub svarte med HTTP ${res.status}`,
        };
      }
      const page = (await res.json()) as GithubIssueComment[];
      if (Array.isArray(page)) {
        comments.push(...page);
      }
      url = parseGithubLinkNext(res.headers.get('link'));
      pages += 1;
    }
    return { ok: true, comments };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    return { ok: false, error: msg };
  }
}

export async function fetchCiForSha(
  opts: GithubClientOptions,
  sha: string,
): Promise<
  | {
      ok: true;
      checkRuns: { name: string; status: string; conclusion: string | null }[];
      statuses: { context: string; state: string }[];
    }
  | { ok: false; error: string }
> {
  const [checksRes, statusRes] = await Promise.all([
    githubFetch<{ check_runs?: { name: string; status: string; conclusion: string | null }[] }>(
      opts,
      `/repos/${opts.owner}/${opts.repo}/commits/${sha}/check-runs?per_page=100`,
      { method: 'GET' },
    ),
    githubFetch<{ statuses?: { context: string; state: string }[] }>(
      opts,
      `/repos/${opts.owner}/${opts.repo}/commits/${sha}/status`,
      { method: 'GET' },
    ),
  ]);

  if (!checksRes.ok && !statusRes.ok) {
    return { ok: false, error: checksRes.ok ? statusRes.error : checksRes.error };
  }

  return {
    ok: true,
    checkRuns: checksRes.ok
      ? (checksRes.data.check_runs ?? []).map((c) => ({
          name: c.name,
          status: c.status,
          conclusion: c.conclusion,
        }))
      : [],
    statuses: statusRes.ok
      ? (statusRes.data.statuses ?? []).map((s) => ({ context: s.context, state: s.state }))
      : [],
  };
}

export async function mergePullSquash(
  opts: GithubClientOptions,
  number: number,
  sha: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const result = await githubFetch<{ merged?: boolean }>(
    opts,
    `/repos/${opts.owner}/${opts.repo}/pulls/${number}/merge`,
    {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash', sha }),
    },
  );
  if (!result.ok) return result;
  return { ok: true };
}