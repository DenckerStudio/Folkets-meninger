import 'server-only';

import { fetchRunnerStatusFromUrl } from '@/lib/admin/local-ai-hub/runner-status';

export function readLocalAiRunnerStatusUrl(): string | null {
  const url = process.env.LOCAL_AI_RUNNER_STATUS_URL?.trim();
  return url ? url : null;
}

export async function loadLocalAiRunnerStatus() {
  const statusUrl = readLocalAiRunnerStatusUrl();
  if (!statusUrl) {
    return { available: false as const };
  }
  return fetchRunnerStatusFromUrl(statusUrl);
}
