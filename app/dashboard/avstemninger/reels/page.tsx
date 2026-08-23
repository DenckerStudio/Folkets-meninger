import { AvstemningerTabs } from '@/components/polls/avstemninger-tabs';
import { ReelsFeed } from '@/components/polls/reels-feed';
import { PageHeader } from '@/components/page-header';
import { SYSTEM_REEL_DISCLAIMER } from '@/lib/polls/labels';
import {
  getPollTotals,
  getUserPollVote,
  listOpenSystemPolls,
} from '@/lib/polls/service';
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
      <p className="text-sm text-muted-foreground">{SYSTEM_REEL_DISCLAIMER}</p>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          Ingen systemgenererte spørsmål publisert ennå.
        </div>
      ) : (
        <ReelsFeed items={items} />
      )}
    </div>
  );
}
