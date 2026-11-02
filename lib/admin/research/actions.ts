import type { ResearchBriefKind } from '@/lib/admin/research/types';

export const RESEARCH_API_ACTIONS = ['deepen', 'blog'] as const;

export type ResearchApiAction = (typeof RESEARCH_API_ACTIONS)[number];

export function isResearchApiAction(value: string): value is ResearchApiAction {
  return (RESEARCH_API_ACTIONS as readonly string[]).includes(value);
}

export function researchApiActionToKind(action: ResearchApiAction): ResearchBriefKind {
  switch (action) {
    case 'deepen':
      return 'deepen';
    case 'blog':
      return 'blog';
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function researchWebhookPathForAction(action: ResearchApiAction): string {
  switch (action) {
    case 'deepen':
      return 'research-utdyp';
    case 'blog':
      return 'blogg-fra-research';
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
