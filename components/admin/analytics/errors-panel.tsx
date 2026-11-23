import type { AdminAnalyticsOverview } from '@/lib/admin/analytics/overview';
import type { AdminHttpErrorsOverview } from '@/lib/admin/analytics/http-errors';
import { AnalyticsCollectionDisabled } from '@/components/admin/analytics/analytics-collection-disabled';

type AppErrorRow = NonNullable<AdminAnalyticsOverview['traffic']>['topAppErrors'][number];

function formatBucketDateNb(raw: string): string {
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const isoDay = `${match[1]}-${match[2]}-${match[3]}T12:00:00`;
  const date = new Date(isoDay);
  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }
  return date.toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ErrorsPanelProps = {
  collectionEnabled: boolean;
  appLoading: boolean;
  appError: boolean;
  appReady: boolean;
  appErrors: AppErrorRow[];
  edge: AdminHttpErrorsOverview | null;
  edgeLoading: boolean;
  edgeError: boolean;
};

export function ErrorsPanel({
  collectionEnabled,
  appLoading,
  appError,
  appReady,
  appErrors,
  edge,
  edgeLoading,
  edgeError,
}: ErrorsPanelProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Fra serveren</h2>
          <p className="text-sm text-muted-foreground">
            Aggregerte statuskoder fra tilgangslogger. Inkluderer crawlere med mindre de er merket
            som bot.
          </p>
        </div>
        {edgeLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Laster serverstatistikk …
          </p>
        ) : null}
        {edgeError ? (
          <p className="text-sm text-destructive" role="alert">
            Kunne ikke laste serverstatistikk.
          </p>
        ) : null}
        {edge && !edge.ready ? (
          <p
            className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
            role="status"
          >
            Feilstatistikk fra serveren er ikke satt opp ennå.
          </p>
        ) : null}
        {edge?.ready ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Feilforespørsler siste {edge.days} dager:{' '}
              {edge.errorRowCountHuman.toLocaleString('nb-NO')} (menneskelig) ·{' '}
              {edge.errorRowCountBot.toLocaleString('nb-NO')} (bot)
            </p>
            {edge.statusClasses.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Statusklasser fra serveren</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Statusklasse
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                      >
                        Antall
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {edge.statusClasses.map((row) => (
                      <tr key={row.statusClass} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">{row.statusClass}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {row.requestCount.toLocaleString('nb-NO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                Ingen rader fra serveren ennå.
              </p>
            )}
            {edge.fiveXxByDay.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">5xx per dag fra serveren</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Dato
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                      >
                        5xx
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {edge.fiveXxByDay.map((row) => (
                      <tr key={row.bucketDate} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-foreground">
                          {formatBucketDateNb(row.bucketDate)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {row.requestCount.toLocaleString('nb-NO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {edge.top404.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Topp 404 fra serveren</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Sti
                      </th>
                      <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                        Vert
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                      >
                        404
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {edge.top404.map((row) => (
                      <tr
                        key={`${row.host}:${row.pathTemplate}`}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                          {row.pathTemplate}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{row.host || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                          {row.requestCount.toLocaleString('nb-NO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Fra app</h2>
          <p className="text-sm text-muted-foreground">
            Anonyme feilhendelser fra 404-sider og utvalgte API-ruter. Dekker ikke all
            servertrafikk.
          </p>
        </div>
        {!collectionEnabled ? <AnalyticsCollectionDisabled /> : null}
        {collectionEnabled && appLoading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Laster app-feil …
          </p>
        ) : null}
        {collectionEnabled && appError ? (
          <p className="text-sm text-destructive" role="alert">
            Kunne ikke laste app-feil.
          </p>
        ) : null}
        {collectionEnabled && !appLoading && !appError && !appReady ? (
          <p
            className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
            role="status"
          >
            App-feilstatistikk er ikke klar i databasen ennå.
          </p>
        ) : null}
        {collectionEnabled && appReady && appErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">
            Ingen app-feil registrert siste 30 dager.
          </p>
        ) : null}
        {collectionEnabled && appReady && appErrors.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Topp app-feil siste 30 dager</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                    Sti
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-right font-medium text-muted-foreground"
                  >
                    Antall
                  </th>
                </tr>
              </thead>
              <tbody>
                {appErrors.map((row) => (
                  <tr
                    key={`${row.path}:${row.status}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                      {row.path}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-foreground">{row.status}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {row.count.toLocaleString('nb-NO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
