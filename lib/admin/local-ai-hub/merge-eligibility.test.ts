import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMergeEligibility } from '@/lib/admin/local-ai-hub/merge-eligibility';
import type { GithubPull } from '@/lib/admin/local-ai-hub/github-client';

const openPull: GithubPull = {
  number: 1,
  html_url: 'https://github.com/example/a/pull/1',
  state: 'open',
  merged: false,
  draft: false,
  mergeable: true,
  mergeable_state: 'clean',
  head: { ref: 'feature', sha: 'abc1234' },
};

describe('computeMergeEligibility', () => {
  it('blokkerer draft-PR med norsk melding', () => {
    const result = computeMergeEligibility({
      pull: { ...openPull, draft: true },
      ci: { state: 'success', checks: [], summary: 'OK' },
      pixel: 'pass',
      friction: 'pass',
    });
    assert.equal(result.canMerge, false);
    assert.ok(result.reasons.some((r) => r.includes('utkast')));
  });

  it('blokkerer når mergeable er null', () => {
    const result = computeMergeEligibility({
      pull: { ...openPull, mergeable: null },
      ci: { state: 'success', checks: [], summary: 'OK' },
      pixel: 'pass',
      friction: 'pass',
    });
    assert.equal(result.canMerge, false);
    assert.ok(result.reasons.some((r) => r.includes('beregner fortsatt')));
  });

  it('blokkerer når CI er null', () => {
    const result = computeMergeEligibility({
      pull: openPull,
      ci: null,
      pixel: 'pass',
      friction: 'pass',
    });
    assert.equal(result.canMerge, false);
    assert.ok(result.reasons.some((r) => r.includes('Kunne ikke hente CI-status')));
  });

  it('tillater merge når alt er grønt', () => {
    const result = computeMergeEligibility({
      pull: openPull,
      ci: { state: 'success', checks: [], summary: 'OK' },
      pixel: 'pass',
      friction: 'pass',
    });
    assert.equal(result.canMerge, true);
    assert.deepEqual(result.reasons, []);
  });
});