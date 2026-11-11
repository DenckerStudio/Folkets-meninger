import type {
  DevTaskProposalDecisionAction,
  DevTaskProposalStatus,
} from '@/lib/admin/dev-task-proposals/types';

export type DevTaskProposalTransitionResult =
  | {
      ok: true;
      nextStatus: DevTaskProposalStatus;
    }
  | { ok: false; error: string };

export function resolveDevTaskProposalDecision(
  currentStatus: DevTaskProposalStatus,
  action: DevTaskProposalDecisionAction,
): DevTaskProposalTransitionResult {
  if (currentStatus !== 'til_godkjenning') {
    return {
      ok: false,
      error: 'Kun forslag som venter på godkjenning kan behandles her.',
    };
  }

  if (action === 'godkjenn') {
    return { ok: true, nextStatus: 'i_prosess' };
  }

  if (action === 'avslå') {
    return { ok: true, nextStatus: 'avslatt' };
  }

  const _exhaustive: never = action;
  return _exhaustive;
}

export function buildDevTaskProposalDecisionPatch(
  transition: Extract<DevTaskProposalTransitionResult, { ok: true }>,
  adminUserId: string,
  nowIso: string,
): Record<string, unknown> {
  return {
    status: transition.nextStatus,
    decided_by: adminUserId,
    decided_at: nowIso,
  };
}
