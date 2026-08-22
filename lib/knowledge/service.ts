import { getAiSummaryFromDb } from '@/lib/ai-summary/service';
import { getServiceSupabase } from '@/lib/supabase';
import { earnedBadgeIds } from './badges';
import { documentReadAward, quizPassAward } from './award';
import { buildKnowledgeQuiz, gradeKnowledgeQuiz } from './quiz';
import type {
  EarnedBadge,
  KnowledgeActivityCounts,
  KnowledgeBadgeId,
  KnowledgeQuizSource,
} from './types';

function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function buildQuizForIssue(source: Omit<KnowledgeQuizSource, 'aiSummary'> & {
  aiSummary?: KnowledgeQuizSource['aiSummary'];
}) {
  const aiSummary = source.aiSummary ?? (await getAiSummaryFromDb(source.issueId));
  return buildKnowledgeQuiz({ ...source, aiSummary });
}

export async function getKnowledgeActivityCounts(userId: string): Promise<KnowledgeActivityCounts> {
  if (!supabaseConfigured()) {
    return {
      quizPasses: 0,
      documentReads: 0,
      counterProposals: 0,
      hearingComments: 0,
      hasFylke: false,
    };
  }

  const service = getServiceSupabase();
  const [quiz, docs, proposals, hearings, user] = await Promise.all([
    service
      .from('user_knowledge_quiz_passes')
      .select('stortinget_issue_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    service
      .from('user_document_reads')
      .select('document_id', { count: 'exact', head: true })
      .eq('user_id', userId),
    service
      .from('counter_proposals')
      .select('id', { count: 'exact', head: true })
      .eq('author_user_id', userId)
      .neq('status', 'withdrawn'),
    service
      .from('hearing_comments')
      .select('id', { count: 'exact', head: true })
      .eq('author_user_id', userId),
    service.from('users').select('fylke_code').eq('id', userId).maybeSingle(),
  ]);

  return {
    quizPasses: quiz.count ?? 0,
    documentReads: docs.count ?? 0,
    counterProposals: proposals.error ? 0 : (proposals.count ?? 0),
    hearingComments: hearings.error ? 0 : (hearings.count ?? 0),
    hasFylke: Boolean(user.data?.fylke_code),
  };
}

export async function listUserBadges(userId: string): Promise<EarnedBadge[]> {
  if (!supabaseConfigured()) return [];
  const service = getServiceSupabase();
  const { data, error } = await service
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId)
    .order('earned_at', { ascending: true });

  if (error || !data) return [];
  return data
    .filter((row) =>
      row.badge_id === 'informert_borger' ||
      row.badge_id === 'saksforsker' ||
      row.badge_id === 'fylkesekspert',
    )
    .map((row) => ({
      id: row.badge_id as KnowledgeBadgeId,
      earnedAt: row.earned_at,
    }));
}

export async function syncUserBadges(userId: string): Promise<KnowledgeBadgeId[]> {
  if (!supabaseConfigured()) return [];
  const counts = await getKnowledgeActivityCounts(userId);
  const ids = earnedBadgeIds(counts);
  if (ids.length === 0) return [];

  const service = getServiceSupabase();
  const rows = ids.map((badgeId) => ({
    user_id: userId,
    badge_id: badgeId,
  }));
  const { error } = await service.from('user_badges').upsert(rows, {
    onConflict: 'user_id,badge_id',
    ignoreDuplicates: true,
  });
  if (error) {
    console.error('syncUserBadges', error);
  }
  return ids;
}

export async function userHasPassedQuiz(userId: string, issueId: string): Promise<boolean> {
  if (!supabaseConfigured()) return false;
  const service = getServiceSupabase();
  const { data } = await service
    .from('user_knowledge_quiz_passes')
    .select('stortinget_issue_id')
    .eq('user_id', userId)
    .eq('stortinget_issue_id', issueId)
    .maybeSingle();
  return Boolean(data);
}

export async function recordQuizPass(options: {
  userId: string;
  issueId: string;
  score: number;
  total: number;
}): Promise<{ awarded: boolean; alreadyPassed: boolean }> {
  if (!supabaseConfigured()) {
    return { awarded: false, alreadyPassed: false };
  }

  const service = getServiceSupabase();
  const { error } = await service.from('user_knowledge_quiz_passes').insert({
    user_id: options.userId,
    stortinget_issue_id: options.issueId,
    score: options.score,
    total: options.total,
  });

  if (error) {
    if (error.code === '23505') {
      return { awarded: false, alreadyPassed: true };
    }
    console.error('recordQuizPass', error);
    return { awarded: false, alreadyPassed: false };
  }

  const awarded = await quizPassAward(options.userId, options.issueId);
  await syncUserBadges(options.userId);
  return { awarded, alreadyPassed: false };
}

export async function recordDocumentRead(options: {
  userId: string;
  issueId: string;
  documentId: string;
}): Promise<{ awarded: boolean; alreadyRead: boolean }> {
  if (!supabaseConfigured()) {
    return { awarded: false, alreadyRead: false };
  }

  const service = getServiceSupabase();
  const { error } = await service.from('user_document_reads').insert({
    user_id: options.userId,
    stortinget_issue_id: options.issueId,
    document_id: options.documentId,
  });

  if (error) {
    if (error.code === '23505') {
      return { awarded: false, alreadyRead: true };
    }
    console.error('recordDocumentRead', error);
    return { awarded: false, alreadyRead: false };
  }

  const awarded = await documentReadAward(options.userId, options.issueId, options.documentId);
  await syncUserBadges(options.userId);
  return { awarded, alreadyRead: false };
}

export async function submitKnowledgeQuiz(options: {
  userId: string;
  source: Omit<KnowledgeQuizSource, 'aiSummary'>;
  answers: Record<string, string>;
}) {
  const quiz = await buildQuizForIssue(options.source);
  const grade = gradeKnowledgeQuiz(quiz, options.answers);
  if (!grade.passed) {
    return {
      ...grade,
      awarded: false,
      alreadyPassed: false,
    };
  }

  const recorded = await recordQuizPass({
    userId: options.userId,
    issueId: options.source.issueId,
    score: grade.score,
    total: grade.total,
  });

  return {
    ...grade,
    awarded: recorded.awarded,
    alreadyPassed: recorded.alreadyPassed,
  };
}
