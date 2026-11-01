import { channelBucketLabel } from '@/lib/admin/analytics/channel-labels';

type PathRow = { path: string; views: number };
type ChannelRow = { bucket: string; views: number };

type TrafficTableProps = {
  topPaths: PathRow[];
  channels: ChannelRow[];
};

function formatViews(views: number): string {
  return views.toLocaleString('nb-NO');
}

export function TrafficTable({ topPaths, channels }: TrafficTableProps) {
  if (topPaths.length === 0 && channels.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen trafikk ennå.</p>;
  }

  return (
    <div className="space-y-8">
      {topPaths.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Topp stier</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Sti</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">
                    Visninger
                  </th>
                </tr>
              </thead>
              <tbody>
                {topPaths.map((row) => (
                  <tr key={row.path} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground sm:text-sm">
                      {row.path}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {formatViews(row.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {channels.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Kanaler</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">Kanal</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">
                    Visninger
                  </th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => (
                  <tr key={row.bucket} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-foreground">
                      {channelBucketLabel(row.bucket)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {formatViews(row.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
