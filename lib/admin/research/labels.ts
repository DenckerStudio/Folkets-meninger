import type { ResearchApiAction } from '@/lib/admin/research/actions';
import type { ResearchBriefKind, ResearchBriefStatus } from '@/lib/admin/research/types';
import { adminBlogPostUrl } from '@/lib/blog/urls';
import { routes } from '@/lib/routes';

export const RESEARCH_KIND_LABELS: Record<ResearchBriefKind, string> = {
  deepen: 'Utdyping',
  blog: 'Blogginnlegg',
  reel: 'Reel',
};

export const RESEARCH_ACTION_LABELS: Record<ResearchApiAction, string> = {
  deepen: 'Utdyp research',
  blog: 'Lag blogginnlegg',
  reel: 'Lag Reel',
};

export const RESEARCH_BRIEF_STATUS_LABELS: Record<ResearchBriefStatus, string> = {
  queued: 'I kø',
  running: 'Kjører',
  done: 'Ferdig',
  failed: 'Feilet',
};

export const RESEARCH_ACTION_CONFIRM: Record<ResearchApiAction, string> = {
  deepen: 'Starte utdyping av denne saken?',
  blog: 'Opprette bloggutkast fra denne saken?',
  reel: 'Opprette Reel-utkast fra denne saken?',
};

export type ResearchBriefOutputLink = { href: string; label: string };

export function researchBriefOutputLink(
  kind: ResearchBriefKind,
  outputRef: string | null,
  status: ResearchBriefStatus,
): ResearchBriefOutputLink | null {
  if (!outputRef || status !== 'done') return null;
  if (kind === 'blog') {
    const href = adminBlogPostUrl(outputRef);
    if (!href) return null;
    return { href, label: 'Åpne bloggutkast' };
  }
  if (kind === 'reel') {
    return { href: routes.adminReels, label: 'Åpne Reel-utkast' };
  }
  if (outputRef.startsWith('http://') || outputRef.startsWith('https://')) {
    return { href: outputRef, label: 'Åpne resultat' };
  }
  return null;
}
