import {
  filterPublishableSources,
  parseTopicBriefSources,
  researchTopicBriefOutputSchema,
  type ResearchTopicBriefSource,
} from '@/lib/admin/research/topic-brief-schema';
import type { z } from 'zod';
import { isBlockedSourceUrl } from '@/lib/sources/blocklist';

type BriefSourcesSection = z.infer<typeof researchTopicBriefOutputSchema>['sources'];

/** Offentlige kilder fra lagret tema-brief — uten Reddit og andre blokkerte domener. */
export function filterPublicTopicBriefSources(
  section: BriefSourcesSection,
): ResearchTopicBriefSource[] {
  return filterPublishableSources(parseTopicBriefSources(section)).filter(
    (source) => !isBlockedSourceUrl(source.url),
  );
}