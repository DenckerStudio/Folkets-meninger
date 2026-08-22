import { getServiceSupabase } from '@/lib/supabase';
import { KNOWLEDGE_POINT_DELTAS, KNOWLEDGE_POINT_REASONS } from './types';

export async function awardKnowledgePoints(options: {
  userId: string;
  delta: number;
  reason: string;
  refType: string;
  refKey: string;
  refId?: string | null;
}): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return false;
  }

  const service = getServiceSupabase();
  const { data, error } = await service.rpc('award_user_points', {
    p_user_id: options.userId,
    p_delta: options.delta,
    p_reason: options.reason,
    p_ref_type: options.refType,
    p_ref_key: options.refKey,
    p_ref_id: options.refId ?? null,
  });

  if (error) {
    console.error('award_user_points', error);
    return false;
  }

  return data === true;
}

export function quizPassAward(userId: string, issueId: string) {
  return awardKnowledgePoints({
    userId,
    delta: KNOWLEDGE_POINT_DELTAS.quizPassed,
    reason: KNOWLEDGE_POINT_REASONS.quizPassed,
    refType: 'sak_quiz',
    refKey: `quiz:${issueId}`,
  });
}

export function documentReadAward(userId: string, issueId: string, documentId: string) {
  return awardKnowledgePoints({
    userId,
    delta: KNOWLEDGE_POINT_DELTAS.documentRead,
    reason: KNOWLEDGE_POINT_REASONS.documentRead,
    refType: 'sak_document',
    refKey: `doc:${issueId}:${documentId}`,
  });
}

export function counterProposalCreatedAward(userId: string, proposalId: string) {
  return awardKnowledgePoints({
    userId,
    delta: KNOWLEDGE_POINT_DELTAS.counterProposalCreated,
    reason: KNOWLEDGE_POINT_REASONS.counterProposalCreated,
    refType: 'counter_proposal',
    refKey: `counter:${proposalId}`,
    refId: proposalId,
  });
}

export function counterProposalEndorsedAward(userId: string, proposalId: string) {
  return awardKnowledgePoints({
    userId,
    delta: KNOWLEDGE_POINT_DELTAS.counterProposalEndorsed,
    reason: KNOWLEDGE_POINT_REASONS.counterProposalEndorsed,
    refType: 'counter_proposal',
    refKey: `endorse:${proposalId}`,
    refId: proposalId,
  });
}

export function hearingCommentAward(userId: string, commentId: string) {
  return awardKnowledgePoints({
    userId,
    delta: KNOWLEDGE_POINT_DELTAS.hearingComment,
    reason: KNOWLEDGE_POINT_REASONS.hearingComment,
    refType: 'hearing_comment',
    refKey: `hearing:${commentId}`,
    refId: commentId,
  });
}
