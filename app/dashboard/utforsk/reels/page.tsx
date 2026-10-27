import { listSystemReelFeedItems } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import { buildPageMetadata } from '@/lib/seo/metadata';
import ReelsFullPage from '@/components/polls/reels-full-page';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Reels',
  description: `Systemgenererte Reels om Stortingssaker. Stem ${pollBallotRunningTextPhrase()}.`,
  canonicalPath: '/dashboard/utforsk/reels',
});

export default async function ReelsPage({
  searchParams,
}: {
  searchParams: Promise<{ poll?: string; preview?: string }>;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { poll, preview } = await searchParams;
  const reelItems =
    process.env.NODE_ENV === 'development' && preview === 'mock'
      ? (await import('@/lib/polls/reels-preview-mock')).REELS_PREVIEW_MOCK_ITEMS
      : await listSystemReelFeedItems(user?.id ?? null, 40, poll ?? null);

  return <ReelsFullPage items={reelItems} initialPollId={poll} />;
}