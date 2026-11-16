import Link from 'next/link';
import type { MinSideOverviewSnapshot } from '@/lib/min-side/overview';
import { MIN_SIDE_NAV_ITEMS, minSideSectionHref } from '@/lib/min-side/sections';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type MinSideOverviewPanelProps = {
  snapshot: MinSideOverviewSnapshot | null;
  showAdminLink?: boolean;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MinSideOverviewPanel({ snapshot, showAdminLink = false }: MinSideOverviewPanelProps) {
  const unavailable = snapshot === null;

  return (
    <div className="space-y-6">
      {unavailable ? (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Nøkkeltall er midlertidig utilgjengelig.
        </p>
      ) : (
        <StatGrid snapshot={snapshot} />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Snarveier</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MIN_SIDE_NAV_ITEMS.filter((item) => item.id !== 'oversikt').map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors',
                    'hover:border-brand/30 hover:bg-brand/[0.03]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                  )}
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href={minSideSectionHref('stemmer-og-meninger')}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
        >
          Se stemmer og meninger
        </Link>
        <Link
          href={routes.utforsk}
          className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Utforsk saker
        </Link>
        {showAdminLink ? (
          <Link
            href={routes.admin}
            className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Admin-hub
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function StatGrid({ snapshot }: { snapshot: MinSideOverviewSnapshot }) {
  const stemmerSum = snapshot.stanceCount + snapshot.pollVoteCount;
  const valgomatLabel = snapshot.valgomatReady
    ? 'Partimatch klar'
    : snapshot.valgomatStanceCount > 0
      ? `${snapshot.valgomatComparableIssues} saker med partidata`
      : 'Ingen holdninger ennå';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Stemmer og holdninger" value={String(stemmerSum)} hint="Saker og avstemninger" />
      <StatCard label="Meninger" value={String(snapshot.opinionCount)} hint="Publiserte innlegg" />
      <StatCard label="Valgomat" value={String(snapshot.valgomatStanceCount)} hint={valgomatLabel} />
      <StatCard
        label="Stemme+"
        value={snapshot.stemmePlusActive ? 'Aktiv' : 'Ikke aktiv'}
        hint={snapshot.stemmePlusActive ? 'Medlemskap på plass' : 'Se fordeler og abonnement'}
      />
    </div>
  );
}