import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PollCard } from '@/components/polls/poll-card';
import { PageHeader } from '@/components/page-header';
import { ActionPollCard } from '@/components/polls/action-poll-card';
import { getPollTotals, listOpenActionPolls, listOpenPolls } from '@/lib/polls/service';
import { buildPageMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Avstemninger',
  description:
    'Nasjonale spørsmål med ja, nei eller blank. Se resultatene og delta i avstemninger.',
  canonicalPath: '/dashboard/avstemninger',
});

export default async function AvstemningerPage() {
  const [polls, actionPolls] = await Promise.all([listOpenPolls(40), listOpenActionPolls(20)]);
  const withTotals = await Promise.all(
    polls.map(async (poll) => ({
      poll,
      totals: await getPollTotals(poll.id),
    })),
  );
  const actionWithTotals = await Promise.all(
    actionPolls.map(async (poll) => ({
      poll,
      totals: await getPollTotals(poll.id),
    })),
  );

  return (
    <DashboardPage className="space-y-10">
      <PageHeader
        title="Avstemninger"
        description="Samme ja/nei/blank-spørsmål som under Utforsk → Reels, samlet i liste. Enkeltsaker fra Stortinget finner du under Utforsk."
      />
      {withTotals.length === 0 ? (
        <EmptyState
          title="Ingen avstemninger er publisert ennå"
          description="Når en stortingssak løftes til nasjonal avstemning, dukker den opp her. Kom gjerne tilbake senere."
        />
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {withTotals.map(({ poll, totals }) => (
            <PollCard key={poll.id} poll={poll} totals={totals} />
          ))}
        </div>
      )}

      <section className="space-y-4 border-t border-border pt-8">
        <PageHeader
          as="h2"
          title="Aksjoner"
          description="Automatisk oppdaget, tallene er ikke verifisert. Disse vises ikke i Reels på Utforsk."
        />
        {actionWithTotals.length === 0 ? (
          <EmptyState
            title="Ingen aksjonsavstemninger ennå"
            description="Når vi oppdager nasjonale aksjoner som passer kriteriene, kan de publiseres her etter admin-gjennomgang."
          />
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {actionWithTotals.map(({ poll, totals }) => (
              <ActionPollCard key={poll.id} poll={poll} totals={totals} />
            ))}
          </div>
        )}
      </section>
    </DashboardPage>
  );
}
