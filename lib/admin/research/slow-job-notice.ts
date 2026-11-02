import type { ResearchBriefStatus } from '@/lib/admin/research/types';

/** Vis «tar lengre tid»-merknad etter dette antall ms i kø/kjører (server-tidsstempel). */
export const RESEARCH_JOB_SLOW_NOTICE_MS = 3 * 60 * 1000;

export const RESEARCH_JOB_SLOW_NOTICE_HEADLINE = 'Tar lengre tid enn vanlig.';

export const RESEARCH_JOB_SLOW_NOTICE_DETAIL =
  'Markeres som feilet etter 30 min, så kan du prøve igjen.';

export type ResearchBriefTimingFields = {
  status: ResearchBriefStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

export function researchJobAgeAnchorIso(brief: {
  created_at?: string | null;
  updated_at?: string | null;
}): string | null {
  const created = brief.created_at?.trim();
  if (created) return created;
  const updated = brief.updated_at?.trim();
  return updated || null;
}

export function shouldShowResearchJobSlowNotice(
  brief: ResearchBriefTimingFields | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!brief) return false;
  if (brief.status !== 'queued' && brief.status !== 'running') return false;
  const anchorIso = researchJobAgeAnchorIso(brief);
  if (!anchorIso) return false;
  const anchorMs = Date.parse(anchorIso);
  if (!Number.isFinite(anchorMs)) return false;
  return nowMs - anchorMs >= RESEARCH_JOB_SLOW_NOTICE_MS;
}

export function shouldShowResearchRowSlowNotice(
  briefs: readonly (ResearchBriefTimingFields | null | undefined)[],
  nowMs: number = Date.now(),
): boolean {
  return briefs.some((brief) => shouldShowResearchJobSlowNotice(brief, nowMs));
}
