import type { AiSummary } from '@/lib/ai-summary/types';

export type KnowledgeBadgeId = 'informert_borger' | 'saksforsker' | 'fylkesekspert';

export type KnowledgeBadge = {
  id: KnowledgeBadgeId;
  name: string;
  description: string;
  howToEarn: string;
};

export type KnowledgeQuizQuestionKind =
  | 'hva'
  | 'hvem'
  | 'konsekvens'
  | 'komite'
  | 'tema'
  | 'kategori';

export type QuizContextLevel = 'rich' | 'basic' | 'minimal';

export type KnowledgeQuizOption = {
  id: string;
  text: string;
};

export type KnowledgeQuizQuestion = {
  id: string;
  kind: KnowledgeQuizQuestionKind;
  prompt: string;
  options: KnowledgeQuizOption[];
  correctOptionId: string;
};

export type PublicKnowledgeQuizQuestion = {
  id: string;
  kind: KnowledgeQuizQuestionKind;
  prompt: string;
  options: KnowledgeQuizOption[];
};

export type KnowledgeQuiz = {
  issueId: string;
  questions: KnowledgeQuizQuestion[];
  passScore: number;
};

export type KnowledgeQuizSource = {
  issueId: string;
  title: string;
  summary?: string | null;
  category?: string | null;
  komite?: string | null;
  aiSummary?: AiSummary | null;
};

export type KnowledgeActivityCounts = {
  quizPasses: number;
  documentReads: number;
  counterProposals: number;
  hearingComments: number;
  hasFylke: boolean;
};

export type EarnedBadge = {
  id: KnowledgeBadgeId;
  earnedAt: string;
};

export const KNOWLEDGE_POINT_REASONS = {
  quizPassed: 'knowledge_quiz_passed',
  documentRead: 'document_read',
  counterProposalCreated: 'counter_proposal_created',
  counterProposalEndorsed: 'counter_proposal_endorsed',
  hearingComment: 'hearing_comment_constructive',
} as const;

export const KNOWLEDGE_POINT_DELTAS = {
  quizPassed: 15,
  documentRead: 5,
  counterProposalCreated: 20,
  counterProposalEndorsed: 2,
  hearingComment: 10,
} as const;

export const CONSTRUCTIVE_COMMENT_MIN_CHARS = 80;
export const CONSTRUCTIVE_COMMENT_MIN_WORDS = 12;
