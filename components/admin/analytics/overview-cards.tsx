import type { AdminAnalyticsOverview } from '@/lib/admin/analytics/overview';

type OverviewCardsProps = {
  user: NonNullable<AdminAnalyticsOverview['user']>;
  traffic: NonNullable<AdminAnalyticsOverview['traffic']>;
};

type StatCardProps = {
  label: string;
  value: number;
  caption?: string;
};

function StatCard({ label, value, caption }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString('nb-NO')}
      </p>
      {caption ? <p className="mt-2 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function OverviewCards({ user, traffic }: OverviewCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Sidevisninger (30 dager)" value={traffic.pageViews} />
      <StatCard
        label="Unike besøkende"
        value={traffic.uniqueVisitors}
        caption="Telles når besøksanalyse er slått på."
      />
      <StatCard label="Registrerte" value={user.totalRegistered} />
      <StatCard label="Nye siste 7 dager" value={user.newLast7Days} />
      <StatCard label="Innlogget siste 30 dager" value={user.signedInLast30Days} />
      <StatCard
        label="Inaktive"
        value={user.inactiveApprox}
        caption={`Ingen innlogging på ${user.inactiveDaysThreshold} dager, eller aldri innlogget.`}
      />
      <StatCard label="Stemme+" value={user.stemmePlus} />
      <StatCard label="Landinger på avstemninger" value={traffic.pollLandings} />
      <StatCard label="Klikk på delingslenker" value={traffic.shareClicks} />
    </div>
  );
}
