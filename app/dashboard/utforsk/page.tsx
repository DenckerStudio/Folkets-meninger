import { getSaker } from '@/lib/stortinget';
import ExploreClient from './explore-client';

export const revalidate = 3600;

export default async function ExplorePage() {
  const initialIssues = await getSaker({ nextRevalidateSeconds: 3600 });
  return <ExploreClient initialIssues={initialIssues} />;
}
