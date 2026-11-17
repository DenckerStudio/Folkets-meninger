import 'server-only';

import { LOCAL_AI_GITHUB_REPO } from '@/lib/admin/local-ai-hub/labels';

export type LocalAiHubConfig =
  | {
      ok: true;
      apiUrl: string;
      apiToken: string;
      projectId: number;
      githubToken: string;
      githubOwner: string;
      githubRepo: string;
    }
  | { ok: false; missing: string[] };

function defaultProjectId(): number {
  const raw = process.env.VIKUNJA_LOCAL_AI_PROJECT_ID?.trim();
  if (!raw) return 5;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export function readLocalAiHubConfig(): LocalAiHubConfig {
  const missing: string[] = [];
  const apiUrl = process.env.VIKUNJA_API_URL?.trim();
  if (!apiUrl) missing.push('VIKUNJA_API_URL');
  const apiToken = process.env.VIKUNJA_API_TOKEN?.trim();
  if (!apiToken) missing.push('VIKUNJA_API_TOKEN');
  const githubToken = process.env.GITHUB_ADMIN_MERGE_TOKEN?.trim();
  if (!githubToken) missing.push('GITHUB_ADMIN_MERGE_TOKEN');

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    apiUrl: apiUrl!,
    apiToken: apiToken!,
    projectId: defaultProjectId(),
    githubToken: githubToken!,
    githubOwner: LOCAL_AI_GITHUB_REPO.owner,
    githubRepo: LOCAL_AI_GITHUB_REPO.repo,
  };
}