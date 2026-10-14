import { getSaker } from '@/lib/stortinget';
import { getIssueAiLabelsMap, getPopularAiLabels } from '@/lib/ai-summary/service';
import { listSystemReelFeedItems } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildPageMetadata } from '@/lib/seo/metadata';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Utforsk',
  description:
    'Utforsk Stortingssaker og systemgenererte Reels. Les saksgang, dokumenter og si din mening.',
  canonicalPath: '/dashboard/utforsk',
});

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ poll?: string }>;
}) {
  const { poll } = await searchParams;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [initialIssues, issueLabels, popularLabels, reelItems] = await Promise.all([
    getSaker(),
    getIssueAiLabelsMap(),
    getPopularAiLabels(),
    // Legacy ?poll=X#reels deep links: make sure that poll is in the feed.
    listSystemReelFeedItems(user?.id ?? null, 40, poll ?? null),
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
