import {
  ROADMAP_STATUS_ORDER,
  roadmapStatusLabel,
  type RoadmapItem,
  type RoadmapStatus,
} from '@/lib/appens-fremtid/constants';

export function RoadmapList({ items }: { items: RoadmapItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Veikartet er tomt ennå.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {ROADMAP_STATUS_ORDER.map((status) => {
        const group = items.filter((item) => item.status === status);
        if (group.length === 0) return null;
        return (
          <section key={status} className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{roadmapStatusLabel(status)}</h3>
            <ul className="space-y-3">
              {group.map((item) => (
                <RoadmapCard key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function RoadmapCard({ item }: { item: RoadmapItem }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="text-base font-semibold text-foreground">{item.title}</h4>
        <StatusBadge status={item.status} />
      </div>
      <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{item.body}</p>
    </li>
  );
}

function StatusBadge({ status }: { status: RoadmapStatus }) {
  const className =
    status === 'in_progress'
      ? 'bg-brand/10 text-brand'
      : status === 'done'
        ? 'bg-muted text-muted-foreground'
        : 'bg-muted text-foreground';

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {roadmapStatusLabel(status)}
    </span>
  );
}
