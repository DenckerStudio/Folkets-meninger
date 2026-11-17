import { type CiRollup, ciBlocksMerge } from '@/lib/admin/local-ai-hub/ci-rollup';
import type { ReviewVerdictOutcome } from '@/lib/admin/local-ai-hub/verdict-parser';
import type { GithubPull } from '@/lib/admin/local-ai-hub/github-client';

export type MergeEligibility = {
  canMerge: boolean;
  reasons: string[];
};

export function computeMergeEligibility(input: {
  pull: GithubPull | null;
  ci: CiRollup | null;
  pixel: ReviewVerdictOutcome;
  friction: ReviewVerdictOutcome;
}): MergeEligibility {
  const reasons: string[] = [];
  const pull = input.pull;

  if (!pull) {
    reasons.push('Fant ingen tilknyttet pull request');
    return { canMerge: false, reasons };
  }
  if (pull.state !== 'open') {
    reasons.push('Pull request er ikke åpen');
  }
  if (pull.mergeable === false) {
    reasons.push('Pull request er ikke mergebar (konflikt eller sperre)');
  }
  if (input.ci && ciBlocksMerge(input.ci)) {
    reasons.push(input.ci.summary);
  }
  if (input.pixel !== 'pass') {
    reasons.push(
      input.pixel === 'fail'
        ? 'Pixel UI har ikke godkjent denne head-SHA'
        : 'Mangler godkjenning fra Pixel UI på head-SHA',
    );
  }
  if (input.friction !== 'pass') {
    reasons.push(
      input.friction === 'fail'
        ? 'Friction UX har ikke godkjent denne head-SHA'
        : 'Mangler godkjenning fra Friction UX på head-SHA',
    );
  }

  const canMerge = reasons.length === 0;
  return { canMerge, reasons: canMerge ? [] : reasons };
}