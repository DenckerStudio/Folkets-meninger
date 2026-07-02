import { getSaker } from '@/lib/stortinget';
import { getIssueAiLabelsMap, getPopularAiLabels } from '@/lib/ai-summary/service';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

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
