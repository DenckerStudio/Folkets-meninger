import { getSaker } from '@/lib/stortinget';
import ExploreClient from './explore-client';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  const initialIssues = await getSaker();
  return <ExploreClient initialIssues={initialIssues} />;
}
