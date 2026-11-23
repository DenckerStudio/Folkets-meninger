import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin/gate';
import { adminReelDraftUrl } from '@/lib/admin/research/labels';
import { listSystemPollDrafts } from '@/lib/polls/service';
import { routes } from '@/lib/routes';
import AdminReelsClient from './admin-reels-client';

export const dynamic = 'force-dynamic';

export default async function AdminReelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage(routes.adminReels);
  const params = await searchParams;
  const rawPollId = params.pollId;
  const pollId = (Array.isArray(rawPollId) ? rawPollId[0] : rawPollId)?.trim() ?? '';
  if (pollId) {
    redirect(adminReelDraftUrl(pollId));
  }

  const drafts = await listSystemPollDrafts(50);
  return <AdminReelsClient initialDraftCount={drafts.length} />;
}
