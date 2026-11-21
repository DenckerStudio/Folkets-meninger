import { ABOUT_BLOG_CATEGORY_SLUG, findForbiddenAboutTerms } from '@/lib/blog/about-draft';
import {
  createAboutSuggestion,
  type AboutSuggestion,
  type AboutWrittenPiece,
} from '@/lib/blog/about-suggestions';
import { OM_INTRO, OM_PROCESS_STEPS, OM_WHY_POINTS } from '@/lib/landing/om-content';

/** Research-spor blir utkast i kategorien «Om Folkets Meninger». */
export const ABOUT_RESEARCH_DRAFT_CATEGORY = ABOUT_BLOG_CATEGORY_SLUG;

const RESEARCH_LIMIT = 3;

export type AboutResearchSourceKind = 'cluster' | 'reddit' | 'unknown';

export type AboutResearchSignal = {
  clusterId: string | null;
  topicId: string | null;
  sourceKind: AboutResearchSourceKind;
  actionName: string;
  topic: string | null;
  description: string;
  target: string | null;
};

type ResearchFacet = {
  id: string;
  pattern: RegExp;
  title: string;
  angle: string;
  label: string;
};

function researchFacets(): ResearchFacet[] {
  const visning = OM_WHY_POINTS.find((point) => point.title === 'Sammenlign med vedtak');
  const avstemning = OM_PROCESS_STEPS.find((step) => step.title === 'Avstemninger');
  return [
    {
      id: 'visning',
      pattern: /viser meninger|meninger vises|folkets vilje|holdningsstatistikk|offentlig statistikk/,
      title: 'Slik viser vi meninger',
      angle: visning?.body ?? '',
      label: 'hvordan meninger vises',
    },
    {
      id: 'avstemning',
      pattern: /avstemning|meningsmåling/,
      title: 'Slik fungerer avstemningene',
      angle: avstemning?.body ?? '',
      label: 'avstemninger',
    },
    {
      id: 'demokrati',
      pattern: /digitalt?\s+demokrati/,
      title: 'Digitalt demokrati i Folkets Meninger',
      angle: OM_INTRO,
      label: 'digitalt demokrati',
    },
    {
      id: 'tjenesten',
      pattern: /folkets[\s-]+meninger|folkets-meninger/,
      title: 'Hva Folkets Meninger er',
      angle: OM_INTRO,
      label: 'selve tjenesten',
    },
  ];
}

export function matchProductResearchFacet(text: string): ResearchFacet | null {
  const hay = text.toLocaleLowerCase('nb');
  return researchFacets().find((facet) => facet.pattern.test(hay)) ?? null;
}

function signalText(signal: AboutResearchSignal): string {
  return [signal.actionName, signal.topic, signal.description, signal.target]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n');
}

function safeClusterLabel(signal: AboutResearchSignal, facet: ResearchFacet): string {
  const name = signal.actionName.replace(/\s+/g, ' ').trim();
  if (!name || name.length > 80 || findForbiddenAboutTerms(name).length > 0) return facet.label;
  return name;
}

function suggestionKey(signal: AboutResearchSignal): string | null {
  if (signal.clusterId) return `research:${signal.clusterId}`;
  if (signal.topicId) return `research:topic:${signal.topicId}`;
  return null;
}

export function buildResearchAboutSuggestions(
  signals: AboutResearchSignal[],
  written: AboutWrittenPiece[] = [],
): AboutSuggestion[] {
  const suggestions: AboutSuggestion[] = [];
  const seen = new Set<string>();

  for (const signal of signals) {
    const key = suggestionKey(signal);
    if (!key || seen.has(key)) continue;
    const facet = matchProductResearchFacet(signalText(signal));
    if (!facet) continue;

    const interestOnly = signal.sourceKind === 'reddit';
    const label = safeClusterLabel(signal, facet);
    const reason = interestOnly
      ? 'Et research-spor er bare et interessesignal og ikke et faktagrunnlag. Vurder om-innlegget ut fra teksten på Om-siden.'
      : `Klyngen «${label}» gjelder ${facet.label}. Dette er et spor til et om-innlegg, ikke et forskningsnotat.`;

    const suggestion = createAboutSuggestion({
      key,
      title: facet.title,
      angle: facet.angle,
      reason,
      source: 'research',
      written,
      provenance: {
        clusterId: signal.clusterId ?? undefined,
        topicId: signal.topicId ?? undefined,
        interestOnly,
      },
    });
    if (!suggestion) continue;
    seen.add(key);
    suggestions.push(suggestion);
    if (suggestions.length >= RESEARCH_LIMIT) break;
  }

  return suggestions;
}
