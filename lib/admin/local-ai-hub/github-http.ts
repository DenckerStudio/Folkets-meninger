import { githubConditionalJsonGet } from '@/lib/admin/local-ai-hub/github-conditional-json-get';
import { parseGithubLinkNext } from '@/lib/admin/local-ai-hub/github-link';
import { LOCAL_AI_FETCH_TIMEOUT_MS } from '@/lib/admin/local-ai-hub/labels';

const MAX_ISSUE_COMMENT_PAGES = 10;

export type GithubClientOptions = {
  token: string;
  owner: string;
  repo: string;
};

export type GithubPull = {
  number: number;
  node_id?: string;
  html_url: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft?: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  head: { ref: string; sha: string };
};

export const LOCAL_AI_APPROVE_PR_READY_COMMENT =
  'Satt til ready for review fra admin hub.';

export type GithubIssueComment = {
  id: number;
  body: string | null;
  created_at: string;
  author_association?: string | null;
  user?: { login?: string } | null;
};

function githubAuthHeaders(opts: GithubClientOptions, extra?: HeadersInit): Record<string, string> {
  return {
    Authorization: `Bearer ${opts.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(extra as Record<string, string> | undefined),
  };
}

async function githubFetch<T>(
  opts: GithubClientOptions,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  const method = init?.method ?? 'GET';
  const url = path.startsWith('https://')
    ? path
    : `https://api.github.com${path.startsWith('/') ? path : `/${path}`}`;
  if (method === 'GET') {
    const conditional = await githubConditionalJsonGet<T>({
      url,
      method: 'GET',
      headers: githubAuthHeaders(opts, init?.headers),
      signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
    });
    if (!conditional.ok) return conditional;
    return { ok: true, data: conditional.data };
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers: githubAuthHeaders(opts, init?.headers),
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
      const pageResult = await githubConditionalJsonGet<GithubIssueComment[]>({
        url,
        headers: githubAuthHeaders(opts),
        signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
      });
      if (!pageResult.ok) {
        return {
          ok: false,
          error: pageResult.error,
        };
      }
      const page = pageResult.data;
      if (Array.isArray(page)) {
        comments.push(...page);
      }
      url = parseGithubLinkNext(pageResult.linkHeader);
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

async function githubGraphql(
  opts: GithubClientOptions,
  body: { query: string; variables?: Record<string, unknown> },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LOCAL_AI_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    const payload = (await res.json().catch(() => null)) as {
      data?: { markPullRequestReadyForReview?: { pullRequest?: { isDraft?: boolean } } };
      errors?: { message?: string }[];
    } | null;
    if (!res.ok) {
      const errMsg =
        payload?.errors?.map((e) => e.message).filter(Boolean).join('; ') ||
        `GitHub GraphQL svarte med HTTP ${res.status}`;
      return { ok: false, error: errMsg, status: res.status };
    }
    if (payload?.errors?.length) {
      return {
        ok: false,
        error: payload.errors.map((e) => e.message ?? 'Ukjent GraphQL-feil').join('; '),
      };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ukjent feil';
    return { ok: false, error: msg };
  }
}

export async function markPullRequestReadyForReview(
  opts: GithubClientOptions,
  pullRequestNodeId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  return githubGraphql(opts, {
    query: `mutation MarkReady($id: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $id }) {
        pullRequest { isDraft }
      }
    }`,
    variables: { id: pullRequestNodeId },
  });
}

export async function postIssueComment(
  opts: GithubClientOptions,
  issueNumber: number,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const result = await githubFetch<{ id?: number }>(
    opts,
    `/repos/${opts.owner}/${opts.repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
  if (!result.ok) return result;
  return { ok: true };
}