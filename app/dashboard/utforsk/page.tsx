import { getSaker } from '@/lib/stortinget';
import { getIssueAiLabelsMap, getPopularAiLabels } from '@/lib/ai-summary/service';
import { listSystemReelFeedItems } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [initialIssues, issueLabels, popularLabels, reelItems] = await Promise.all([
    getSaker(),
    getIssueAiLabelsMap(),
    getPopularAiLabels(),
    listSystemReelFeedItems(user?.id ?? null),
  ]);

  return (
    <ExploreClient
      initialIssues={initialIssues}
      issueLabels={issueLabels}
      popularLabels={popularLabels}
      reelItems={reelItems}
    />
  );
}
