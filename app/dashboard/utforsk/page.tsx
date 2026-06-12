import { getSaker } from '@/lib/stortinget';
import { getIssueAiLabelsMap, getPopularAiLabels } from '@/lib/ai-summary/service';
import ExploreClient from './explore-client';

export const revalidate = 3600;

export default async function ExplorePage() {
  const [initialIssues, issueLabels, popularLabels] = await Promise.all([
    getSaker({ nextRevalidateSeconds: 3600 }),
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
