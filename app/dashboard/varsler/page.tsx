'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, CheckCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { routes } from '@/lib/routes';

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
  read_at: string | null;
  channel: string;
  type: string;
};

export default function VarslerPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [pending, setPending] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setPending(true);
    try {
      const res = await fetch('/api/notifications?limit=100', { cache: 'no-store' });
      const json = await res.json();
      setItems(json.notifications || []);
    } finally {
      setPending(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
    await load();
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Laster...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10">
          <Bell className="h-10 w-10 text-brand" />
        </div>
        <PageHeader as="h2" title="Logg inn for å se varsler" />
        <p className="text-muted-foreground">Du må være logget inn for å se in-app varsler.</p>
        <Link
          href={routes.login}
          className="inline-flex items-center rounded-xl bg-brand px-6 py-3 font-medium text-white transition-colors hover:bg-brand/90"
        >
          <LogIn className="mr-2 h-5 w-5" />
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Varsler"
          description="In-app varsler. E-postinnstillinger ligger under Preferanser."
          className="flex-1"
        />
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted/50"
          disabled={pending}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Marker alle som lest
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        <Link href={`${routes.minSide}?tab=preferanser`} className="font-medium text-brand hover:underline">
          Administrer e-postvarsler
        </Link>
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
          Ingen varsler ennå.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={`p-5 ${n.read_at ? 'bg-card' : 'bg-brand/5'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{n.title}</div>
                    {n.body ? <div className="mt-1 text-sm text-muted-foreground">{n.body}</div> : null}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString('nb-NO')}
                    </div>
                  </div>
                  {n.url ? (
                    <Link
                      href={n.url}
                      className="shrink-0 text-sm font-medium text-brand hover:underline"
                    >
                      Åpne
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
