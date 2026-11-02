import type { ResearchBriefsByKind } from '@/lib/admin/research/service';
import { getResearchBriefsByKindForCluster } from '@/lib/admin/research/service';
import { expireStaleResearchBriefsThrottled } from '@/lib/admin/research/expire-stale-throttled';

export type FetchResearchClusterBriefsDeps = {
  expireStale?: () => Promise<void>;
  loadBriefs?: (clusterId: string) => Promise<Partial<ResearchBriefsByKind>>;
};

export async function fetchResearchClusterBriefsForPoll(
  clusterId: string,
  deps: FetchResearchClusterBriefsDeps = {},
): Promise<Partial<ResearchBriefsByKind>> {
  if (deps.expireStale) {
    try {
      await deps.expireStale();
    } catch (error) {
      console.warn('[research] research_briefs_expire_stale failed:', error);
    }
  } else {
    await expireStaleResearchBriefsThrottled();
  }
  const load = deps.loadBriefs ?? getResearchBriefsByKindForCluster;
  return load(clusterId);
}
