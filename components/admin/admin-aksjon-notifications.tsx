import Link from 'next/link';
import { listRecentAksjonOpsEvents } from '@/lib/admin/aksjon-ops-events';
import { routes } from '@/lib/routes';

export async function AdminAksjonNotifications() {
  const events = await listRecentAksjonOpsEvents(12);
  if (events.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Aksjonsvarsler (7 dager)</h2>
        <Link
          href={routes.adminAksjoner}
          className="text-sm font-medium text-brand hover:underline"
        >
          Gå til Aksjoner →
        </Link>
      </div>
      <ul className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium text-foreground">{event.subject}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(event.createdAt).toLocaleString('nb-NO')}
              {event.clusterKey ? ` · ${event.clusterKey}` : ''}
            </p>
            {event.text ? <p className="mt-1 text-sm text-muted-foreground">{event.text}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
