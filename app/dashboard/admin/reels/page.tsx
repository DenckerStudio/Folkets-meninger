import { redirect } from 'next/navigation';
import { adminReelDraftUrl } from '@/lib/admin/research/labels';
import { listSystemPollDrafts } from '@/lib/polls/service';
import AdminReelsClient from './admin-reels-client';

export const dynamic = 'force-dynamic';

export default async function AdminReelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPollId = params.pollId;
  const pollId = (Array.isArray(rawPollId) ? rawPollId[0] : rawPollId)?.trim() ?? '';
  if (pollId) {
    redirect(adminReelDraftUrl(pollId));
  }

  const drafts = await listSystemPollDrafts(50);
  return <AdminReelsClient initialDraftCount={drafts.length} />;
}
