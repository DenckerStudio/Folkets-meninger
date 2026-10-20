import type { ResearchApiAction } from '@/lib/admin/research/actions';
import type { ResearchBriefsByKind } from '@/lib/admin/research/service';
import type { ResearchBriefStatus } from '@/lib/admin/research/types';

export const RESEARCH_BRIEF_POLL_MS = 5000;

const POLL_ACTIONS: ResearchApiAction[] = ['deepen', 'blog', 'reel'];

export function isActiveResearchBriefStatus(status: ResearchBriefStatus | undefined): boolean {
  return status === 'queued' || status === 'running';
}

export function hasActiveResearchBriefs(briefsByKind: ResearchBriefsByKind): boolean {
  return POLL_ACTIONS.some((action) => isActiveResearchBriefStatus(briefsByKind[action]?.status));
}
