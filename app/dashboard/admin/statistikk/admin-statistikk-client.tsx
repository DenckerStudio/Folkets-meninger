'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Download } from 'lucide-react';
import type { AdminAnalyticsOverview } from '@/lib/admin/analytics/overview';
import { OverviewCards } from '@/components/admin/analytics/overview-cards';
import { ShareLinksTable } from '@/components/admin/analytics/share-links-table';
import { TrafficTable } from '@/components/admin/analytics/traffic-table';
import { AnalyticsCollectionDisabled } from '@/components/admin/analytics/analytics-collection-disabled';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { isAnalyticsEnabled } from '@/lib/analytics/flags';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { PUBLIC_STATS_DISCLAIMER } from '@/lib/government-stats/snapshot';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

const NOT_READY_MESSAGE =
  'Statistikken er ikke klar i databasen ennå. En administrator må kjøre den ventende databasemigrasjonen før tallene vises her.';

const STAT_TABS = [
  { id: 'oversikt', label: 'Oversikt' },
  { id: 'trafikk', label: 'Trafikk' },
  { id: 'deling', label: 'Deling' },
  { id: 'blogg', label: 'Blogg' },
  { id: 'eksport', label: 'Eksport' },
] as const;

type StatTabId = (typeof STAT_TABS)[number]['id'];

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: AdminAnalyticsOverview };

function AnalyticsNotReady() {
  return (
    <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
      {NOT_READY_MESSAGE}
    </p>
  );
}

function BlogPathsTable({
  blogPaths,
  collectionEnabled,
}: {
  blogPaths: NonNullable<AdminAnalyticsOverview['traffic']>['blogPaths'];
  collectionEnabled: boolean;
}) {
  if (!collectionEnabled) {
    return <AnalyticsCollectionDisabled />;
  }

  if (blogPaths.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen bloggvisninger ennå.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">Sti</th>
            <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground text-right">
              Visninger
            </th>
          </tr>
        </thead>
        <tbody>
          {blogPaths.map((row) => (
            <tr key={row.path} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                {row.path}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {row.views.toLocaleString('nb-NO')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportPanel({
  downloading,
  onDownloadCsv,
}: {
  downloading: boolean;
  onDownloadCsv: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
        {PUBLIC_STATS_DISCLAIMER}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownloadCsv}
          disabled={downloading}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50',
            VURDER_FOCUS_RING,
          )}
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Laster ned…' : 'Last ned CSV'}
        </button>
        <a
          href="/api/admin/government-stats/export?format=json&limit=200"
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50',
            VURDER_FOCUS_RING,
          )}
        >
          JSON (krever innlogging)
        </a>
        <Link
          href={routes.innsikt}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50',
            VURDER_FOCUS_RING,
          )}
        >
          Offentlig innsikt-side →
        </Link>
      </div>
    </div>
  );
}

function StatTabPanel({
  tab,
  loadState,
  downloading,
  onDownloadCsv,
}: {
  tab: StatTabId;
  loadState: LoadState;
  downloading: boolean;
  onDownloadCsv: () => void;
}) {
  const trafficCollectionEnabled = isAnalyticsEnabled();

  if (tab === 'eksport') {
    return <ExportPanel downloading={downloading} onDownloadCsv={onDownloadCsv} />;
  }

  if (loadState.status === 'loading') {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Laster statistikk …
      </p>
    );
  }

  if (loadState.status === 'error') {
    return (
      <p className="text-sm text-destructive" role="alert">
        Kunne ikke laste statistikk.
      </p>
    );
  }

  const { data } = loadState;

  if (!data.ready) {
    return <AnalyticsNotReady />;
  }

  switch (tab) {
    case 'oversikt':
      if (!data.user || !data.traffic) {
        return <AnalyticsNotReady />;
      }
      return (
        <OverviewCards
          user={data.user}
          traffic={data.traffic}
          trafficCollectionEnabled={trafficCollectionEnabled}
        />
      );
    case 'trafikk':
      if (!data.traffic) {
        return <AnalyticsNotReady />;
      }
      return (
        <TrafficTable
          topPaths={data.traffic.topPaths}
          channels={data.traffic.channels}
          collectionEnabled={trafficCollectionEnabled}
        />
      );
    case 'deling':
      return <ShareLinksTable links={data.links} />;
    case 'blogg':
      if (!data.traffic) {
        return <AnalyticsNotReady />;
      }
      return (
        <BlogPathsTable
          blogPaths={data.traffic.blogPaths}
          collectionEnabled={trafficCollectionEnabled}
        />
      );
    default: {
      const unreachable: never = tab;
      return unreachable;
    }
  }
}

export default function AdminStatistikkClient() {
  const tablistId = useId();
  const [tab, setTab] = useState<StatTabId>('oversikt');
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState({ status: 'loading' });
      try {
        const res = await fetch('/api/admin/analytics/overview', { credentials: 'same-origin' });
        if (!res.ok) {
          if (!cancelled) setLoadState({ status: 'error' });
          return;
        }
        const data = (await res.json()) as AdminAnalyticsOverview;
        if (!cancelled) setLoadState({ status: 'ready', data });
      } catch {
        if (!cancelled) setLoadState({ status: 'error' });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const downloadCsv = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/government-stats/export?format=csv&limit=200');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `folkets-meninger-statistikk-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand" aria-hidden />
          Statistikk
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Besøk, deling og brukertall for admin. Myndighetseksport finnes under fanen Eksport.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1"
        role="tablist"
        aria-label="Statistikkfaner"
      >
        {STAT_TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              id={`${tablistId}-${item.id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`${tablistId}-${item.id}-panel`}
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors sm:min-w-[6.5rem] sm:px-3',
                VURDER_FOCUS_RING,
                selected
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <section
        id={`${tablistId}-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`${tablistId}-${tab}`}
      >
        <StatTabPanel
          tab={tab}
          loadState={loadState}
          downloading={downloading}
          onDownloadCsv={downloadCsv}
        />
      </section>

      <AdminBackLink />
    </div>
  );
}
