import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AvstemningerTabs } from '@/components/polls/avstemninger-tabs';
import { ReelsFeed } from '@/components/polls/reels-feed';
import { PageHeader } from '@/components/page-header';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import {
  getPollTotals,
  getUserPollVote,
  listOpenSystemPolls,
} from '@/lib/polls/service';
import { routes } from '@/lib/routes';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function AvstemningerReelsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const polls = await listOpenSystemPolls(40);
  const items = await Promise.all(
    polls.map(async (poll) => {
      const [totals, voteState] = await Promise.all([
        getPollTotals(poll.id),
        user ? getUserPollVote(user.id, poll.id) : Promise.resolve({ hasVoted: false, vote: null }),
      ]);
      return { poll, totals, userVote: voteState.vote };
    }),
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Reels"
        description="Én systemgenerert ja/nei/blank-spørsmål om gangen. Bla videre for neste."
      />
      <AvstemningerTabs active="reels" />

      {items.length === 0 ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {SYSTEM_REEL_DISCLAIMER}
          </div>
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
              <Sparkles className="h-6 w-6 text-brand" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">Ingen Reels publisert ennå</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Når administratorer har godkjent systemgenererte spørsmål fra stortingssaker, vises de her som
              ja/nei/blank-avstemninger.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Se andre avstemninger under{' '}
              <Link href={routes.avstemninger} className="font-medium text-brand hover:underline">
                Alle avstemninger
              </Link>
              .
            </p>
          </div>
        </div>
      ) : (
        <ReelsFeed items={items} />
      )}
    </div>
  );
}
