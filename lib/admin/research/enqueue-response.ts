import { RESEARCH_API_ERROR_CODES } from '@/lib/admin/research/api-error-codes';
import type { ResearchApiAction } from '@/lib/admin/research/actions';
import type { ResearchBriefSnapshot, ResearchBriefsByKind } from '@/lib/admin/research/service';
import type { ResearchBriefStatus } from '@/lib/admin/research/types';

export type ResearchEnqueueConflictBody = {
  error?: string;
  message?: string;
  request_id?: string;
  status?: ResearchBriefStatus;
};

export type ResearchEnqueueConflictResult =
  | { kind: 'none' }
  | { kind: 'message_only'; message: string }
  | {
      kind: 'sync_active';
      action: ResearchApiAction;
      requestId: string;
      status: ResearchBriefStatus;
      message: string;
    };

export function resolveResearchEnqueueConflict(
  action: ResearchApiAction,
  body: ResearchEnqueueConflictBody,
  fallbackMessage: string,
): ResearchEnqueueConflictResult {
  if (body.error === RESEARCH_API_ERROR_CODES.requestConflict) {
    return {
      kind: 'message_only',
      message: body.message ?? fallbackMessage,
    };
  }
  if (
    body.error === RESEARCH_API_ERROR_CODES.briefActive &&
    typeof body.request_id === 'string' &&
    body.request_id.trim() !== ''
  ) {
    return {
      kind: 'sync_active',
      action,
      requestId: body.request_id,
      status: body.status ?? 'queued',
      message: body.message ?? fallbackMessage,
    };
  }
  if (body.error === RESEARCH_API_ERROR_CODES.briefActive) {
    return {
      kind: 'message_only',
      message: body.message ?? fallbackMessage,
    };
  }
  return { kind: 'none' };
}

export function mergeActiveBriefFromConflict(
  prev: ResearchBriefsByKind,
  action: ResearchApiAction,
  requestId: string,
  status: ResearchBriefStatus,
): ResearchBriefsByKind {
  const previous: ResearchBriefSnapshot | undefined = prev[action];
  return {
    ...prev,
    [action]: {
      kind: action,
      status,
      output_ref: previous?.output_ref ?? null,
      request_id: requestId,
    },
  };
}
