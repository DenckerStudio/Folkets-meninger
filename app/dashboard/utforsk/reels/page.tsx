import type { Metadata } from 'next';
import { listSystemReelFeedItems, getPublicPollById } from '@/lib/polls/service';
import { getServerSupabase } from '@/lib/supabase-server';
import { pollBallotRunningTextPhrase } from '@/lib/polls/ballot-buttons';
import { isShareablePoll } from '@/lib/polls/share';
import { buildUtforskReelPollMetadata } from '@/lib/polls/page-metadata';
import { buildPageMetadata } from '@/lib/seo/metadata';
import ReelsFullPage from '@/components/polls/reels-full-page';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ poll?: string; preview?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { poll: pollId } = await searchParams;
  if (pollId) {
    const poll = await getPublicPollById(pollId).catch(() => null);
    if (poll && isShareablePoll(poll)) {
      return buildUtforskReelPollMetadata(poll);
    }
  }

  return buildPageMetadata({
    title: 'Reels',
    description: `Systemgenererte Reels om Stortingssaker. Stem ${pollBallotRunningTextPhrase()}.`,
    canonicalPath: '/dashboard/utforsk/reels',
    images: ['/dashboard/utforsk/reels/opengraph-image'],
  });
}

export default async function ReelsPage({ searchParams }: PageProps) {
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
