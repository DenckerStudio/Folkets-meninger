import { listSystemPollDrafts } from '@/lib/polls/service';
import AdminReelsClient from './admin-reels-client';

export const dynamic = 'force-dynamic';

export default async function AdminReelsPage() {
  const drafts = await listSystemPollDrafts(50);
  return <AdminReelsClient initialDrafts={drafts} />;
}
