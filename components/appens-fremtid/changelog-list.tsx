import type { ChangelogEntry } from '@/lib/appens-fremtid/constants';
import { formatWhen } from '@/components/appens-fremtid/format';

export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Ingen endringer er publisert ennå.
      </p>
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
