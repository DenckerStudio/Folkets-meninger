import AdminOppfangetClient from '../oppfanget/admin-oppfanget-client';
import RedditSignalsClient from '@/components/admin/reddit-signals-client';
import { requireAdminPage } from '@/lib/admin/gate';
import { parseOppfangetFilters } from '@/lib/admin/oppfanget/query';
import { listOppfangetForAdmin } from '@/lib/admin/oppfanget/service';
import { parseRedditClusterFilters } from '@/lib/reddit-signals/cluster-query';
import { listRedditClustersForAdmin } from '@/lib/reddit-signals/cluster-service';
import { loadRedditLearningStatsForAdmin } from '@/lib/reddit-signals/learning-stats-service';
import {
  isRedditSignalsView,
  isRedditTemaerView,
  parseRedditSignalsFilters,
} from '@/lib/reddit-signals/query';
import { loadRedditSpikeBadgeForAdmin } from '@/lib/reddit-signals/spike-badge-server';
import { listRedditSignalsForAdmin } from '@/lib/reddit-signals/service';
import RedditClustersClient from '@/components/admin/reddit-clusters-client';
import { expireStaleResearchBriefsThrottled } from '@/lib/admin/research/expire-stale-throttled';
import { getLatestResearchBriefsByClusterIds } from '@/lib/admin/research/service';
import { getResearchTopicSnapshotsBySources } from '@/lib/admin/research/topic-service';
import { isOppfangetRedditRow } from '@/lib/admin/oppfanget/types';
import { isResearchWebhookConfigured, getMissingResearchWebhookEnvKeys } from '@/lib/admin/research/webhook-status';
import { routes } from '@/lib/routes';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminResearchPage({ searchParams }: PageProps) {
  await requireAdminPage(routes.adminResearch);

  const params = await searchParams;
  const preview = typeof params.preview === 'string' ? params.preview : undefined;
  const spikeBadge = await loadRedditSpikeBadgeForAdmin(preview);
  const spikeBadgeActive = spikeBadge !== null && spikeBadge.items.length > 0;

  if (isRedditTemaerView(params)) {
    const clusterFilters = parseRedditClusterFilters(params);
    const [clusterResult, learningResult] = await Promise.allSettled([
      listRedditClustersForAdmin(clusterFilters, preview),
      loadRedditLearningStatsForAdmin(preview),
    ]);
    const clusterData =
      clusterResult.status === 'fulfilled'
        ? clusterResult.value
        : {
            clusters: [],
            totalClusters: 0,
            filteredTotal: 0,
            unclusteredCount: 0,
            previewFixture: false,
            tableMissing: true,
            tableMissingMessage: 'Kunne ikke hente temaklynger akkurat nå.',
          };
    const learningStats =
      learningResult.status === 'fulfilled'
        ? learningResult.value
        : {
            rows: [],
            viewMissing: false,
            viewMissingMessage: null,
            loadError: true,
            loadErrorMessage: 'Kunne ikke hente statistikk akkurat nå.',
          };
    return (
      <RedditClustersClient
        initialData={clusterData}
        initialFilters={clusterFilters}
        learningStats={learningStats}
        devPreview={preview}
        spikeBadgeActive={spikeBadgeActive}
      />
    );
  }

  if (isRedditSignalsView(params)) {
    const signalFilters = parseRedditSignalsFilters(params);
    const signalData = await listRedditSignalsForAdmin(signalFilters, preview);
    const { byRedditSignalId } = await getResearchTopicSnapshotsBySources({
      clusterIds: [],
      redditSignalIds: signalData.rows.map((row) => row.id),
    });
    return (
      <RedditSignalsClient
        initialData={signalData}
        initialFilters={signalFilters}
        devPreview={preview}
        spikeBadge={spikeBadge}
        researchTopicsBySignalId={byRedditSignalId}
        researchWebhooksConfigured={isResearchWebhookConfigured()}
        missingResearchWebhookEnvKeys={getMissingResearchWebhookEnvKeys()}
      />
    );
  }

  const filters = parseOppfangetFilters(params);
  await expireStaleResearchBriefsThrottled();
  const initialData = await listOppfangetForAdmin(filters, preview);
  const researchWebhooksConfigured = isResearchWebhookConfigured();
  const missingResearchWebhookEnvKeys = getMissingResearchWebhookEnvKeys();
  const researchBriefsByCluster = await getLatestResearchBriefsByClusterIds(
    initialData.rows.map((row) => row.id),
  );
  const clusterIds = initialData.rows.filter((row) => !isOppfangetRedditRow(row)).map((r) => r.id);
  const redditIds = initialData.rows.filter(isOppfangetRedditRow).map((r) => r.id);
  const { byClusterId: researchTopicsByCluster, byRedditSignalId: researchTopicsByRedditId } =
    await getResearchTopicSnapshotsBySources({
      clusterIds,
      redditSignalIds: redditIds,
    });
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AdminOppfangetClient
      initialData={initialData}
      initialFilters={filters}
      devPreview={preview}
      adminUserId={user?.id}
      initialResearchBriefsByCluster={researchBriefsByCluster}
      initialResearchTopicsByCluster={researchTopicsByCluster}
      initialResearchTopicsByRedditId={researchTopicsByRedditId}
      researchWebhooksConfigured={researchWebhooksConfigured}
      missingResearchWebhookEnvKeys={missingResearchWebhookEnvKeys}
      spikeBadgeActive={spikeBadgeActive}
    />
  );
}
