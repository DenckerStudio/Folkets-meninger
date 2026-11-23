import type { CiRollup } from '@/lib/admin/local-ai-hub/ci-rollup';
import type { MergeEligibility } from '@/lib/admin/local-ai-hub/merge-eligibility';
import type { ReviewVerdictOutcome } from '@/lib/admin/local-ai-hub/verdict-parser';

export type LocalAiFinishedRow = {
  taskId: number;
  title: string;
  failed: boolean;
  failureComment: string | null;
  pr: {
    number: number;
    url: string;
    state: string;
    merged: boolean;
    headSha: string;
    headRef: string;
    mergeable: boolean | null;
  } | null;
  prError: string | null;
  ci: CiRollup | null;
  ciError: string | null;
  pixel: ReviewVerdictOutcome;
  friction: ReviewVerdictOutcome;
  merge: MergeEligibility;
};

export type LocalAiSuggestionRow = {
  taskId: number;
  title: string;
  description: string;
};

export type LocalAiOverviewResult =
  | { ok: false; kind: 'config'; missing: string[] }
  | {
      ok: true;
      ferdig: LocalAiFinishedRow[];
      forslag: LocalAiSuggestionRow[];
      partialErrors: string[];
    };
