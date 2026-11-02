import { getSaker } from '@/lib/stortinget';
import { getIssueAiLabelsMap, getPopularAiLabels } from '@/lib/ai-summary/service';
import { buildPageMetadata } from '@/lib/seo/metadata';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Utforsk',
  description: 'Utforsk Stortingssaker. Les saksgang, dokumenter og si din mening.',
  canonicalPath: '/dashboard/utforsk',
});

export default async function ExplorePage() {
  const [initialIssues, issueLabels, popularLabels] = await Promise.all([
    getSaker(),
    getIssueAiLabelsMap(),
    getPopularAiLabels(),
  ]);

  return (
    <ExploreClient
      initialIssues={initialIssues}
      issueLabels={issueLabels}
      popularLabels={popularLabels}
    />
  );
}
