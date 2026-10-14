import { listSystemReelFeedItems } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildPageMetadata } from '@/lib/seo/metadata';
import ReelsFullPage from '@/components/polls/reels-full-page';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Reels',
  description: 'Systemgenererte Reels om Stortingssaker. Stem ja, nei eller blankt.',
  canonicalPath: '/dashboard/utforsk/reels',
});

export default async function ReelsPage({
  searchParams,
}: {
  searchParams: Promise<{ poll?: string }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { poll } = await searchParams;
  const reelItems = await listSystemReelFeedItems(user?.id ?? null, 40, poll ?? null);

  return <ReelsFullPage items={reelItems} initialPollId={poll} />;
}