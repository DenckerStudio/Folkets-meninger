import type { GithubPull } from '@/lib/admin/local-ai-hub/github-http';

/** CI og PR-kommentarer trengs bare mens PR-en er åpen og ikke merget. */
export function shouldSkipPullGithubEnrichment(pull: GithubPull): boolean {
  return pull.merged || pull.state !== 'open';
}