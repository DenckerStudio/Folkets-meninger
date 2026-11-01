import type { AdminAnalyticsOverview } from '@/lib/admin/analytics/overview';
import { shareTargetKindLabel } from '@/lib/admin/analytics/share-target-labels';

type ShareLinksTableProps = {
  links: AdminAnalyticsOverview['links'];
};

function formatTarget(link: AdminAnalyticsOverview['links'][number]): string {
  const kind = shareTargetKindLabel(link.targetKind);
  return `${kind} · ${link.targetId}`;
}

function formatClicks(clicks: number): string {
  return clicks.toLocaleString('nb-NO');
}

export function ShareLinksTable({ links }: ShareLinksTableProps) {
  if (links.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen delingslenker ennå.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Kode</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Mål</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground">Opprettet av</th>
            <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">Klikk</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2.5 font-mono text-xs text-foreground">{link.code}</td>
              <td className="px-4 py-2.5 text-foreground">{formatTarget(link)}</td>
              <td className="px-4 py-2.5 text-foreground">{link.creatorEmail}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {formatClicks(link.clicks)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
