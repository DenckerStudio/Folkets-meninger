import assert from 'node:assert/strict';

import type { GithubPull } from '@/lib/admin/local-ai-hub/github-http';
import { shouldSkipPullGithubEnrichment } from '@/lib/admin/local-ai-hub/pull-enrichment';

function basePull(overrides: Partial<GithubPull>): GithubPull {
  return {
    number: 1,
    html_url: 'https://example.com/pr/1',
    state: 'open',
    merged: false,
    mergeable: true,
    mergeable_state: 'clean',
    head: { ref: 'branch', sha: 'abc' },
    ...overrides,
  };
}

assert.equal(shouldSkipPullGithubEnrichment(basePull({ state: 'open', merged: false })), false);
assert.equal(shouldSkipPullGithubEnrichment(basePull({ state: 'closed', merged: false })), true);
assert.equal(shouldSkipPullGithubEnrichment(basePull({ state: 'open', merged: true })), true);
assert.equal(shouldSkipPullGithubEnrichment(basePull({ state: 'closed', merged: true })), true);

console.log('lib/admin/local-ai-hub/pull-enrichment.test.ts: ok');
