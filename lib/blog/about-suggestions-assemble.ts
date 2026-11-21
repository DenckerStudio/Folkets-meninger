import {
  buildInternalAboutSuggestions,
  planAboutSuggestionWrites,
  visibleAboutSuggestions,
  withEvergreenFallback,
  type AboutChangelogSignal,
  type AboutRoadmapSignal,
  type AboutSuggestion,
  type AboutSuggestionFeedback,
  type AboutSuggestionWritePlan,
  type AboutWrittenPiece,
} from '@/lib/blog/about-suggestions';
import {
  buildResearchAboutSuggestions,
  type AboutResearchSignal,
} from '@/lib/blog/about-suggestions-research';
import { buildWebAboutSuggestions, type AboutWebHit } from '@/lib/blog/about-suggestions-web';

export type AboutSuggestionCandidateInput = {
  written: AboutWrittenPiece[];
  changelog: AboutChangelogSignal[];
  roadmap: AboutRoadmapSignal[];
  research: AboutResearchSignal[];
  webHits: AboutWebHit[];
};

function dedupeSuggestions(items: AboutSuggestion[]): AboutSuggestion[] {
  const kept: AboutSuggestion[] = [];
  for (const item of items) {
    if (kept.some((previous) => previous.key === item.key)) continue;
    const titles: AboutWrittenPiece[] = kept.map((previous) => ({
      title: previous.title,
      kind: 'publisert',
      at: null,
    }));
    const alreadyListed = titles.some(
      (previous) => previous.title.localeCompare(item.title, 'nb', { sensitivity: 'accent' }) === 0,
    );
    if (alreadyListed) continue;
    kept.push(item);
  }
  return kept;
}

export function collectAboutSuggestionCandidates(
  input: AboutSuggestionCandidateInput,
): { live: AboutSuggestion[]; proposed: AboutSuggestion[] } {
  const live = dedupeSuggestions([
    ...buildInternalAboutSuggestions(input),
    ...buildResearchAboutSuggestions(input.research, input.written),
    ...buildWebAboutSuggestions(input.webHits, input.written),
  ]);
  return { live, proposed: withEvergreenFallback(live, input.written) };
}

export function prepareAboutSuggestionRefresh(args: {
  input: AboutSuggestionCandidateInput;
  existing: AboutSuggestionFeedback[];
  now: Date;
}): { visible: AboutSuggestion[]; plan: AboutSuggestionWritePlan } {
  const { live, proposed } = collectAboutSuggestionCandidates(args.input);
  return {
    visible: visibleAboutSuggestions({
      live,
      written: args.input.written,
      feedback: args.existing,
      now: args.now,
    }),
    plan: planAboutSuggestionWrites({
      existing: args.existing,
      proposed,
      now: args.now,
    }),
  };
}
