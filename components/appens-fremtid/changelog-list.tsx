import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';
import { formatWhen } from '@/components/appens-fremtid/format';
import { EmptyState } from '@/components/dashboard/empty-state';

export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        title="Ingen endringer ennå"
        description="Ingen endringer er publisert ennå."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-base font-semibold text-foreground">{entry.title}</h3>
          <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{entry.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{formatWhen(entry.publishedAt || entry.createdAt)}</p>
        </li>
      ))}
    </ol>
  );
}
