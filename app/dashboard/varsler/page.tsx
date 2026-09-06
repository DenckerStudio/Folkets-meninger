'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, CheckCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';

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
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mx-auto">
          <Bell className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
        </div>
        <PageHeader as="h2" title="Logg inn for å se varsler" />
        <p className="text-muted-foreground">Du må være logget inn for å se in-app varsler.</p>
        <Link
          href="/auth/login"
          className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <LogIn className="w-5 h-5 mr-2" />
          Logg inn
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <PageHeader title="Varsler" className="flex-1" />
        <button
          type="button"
          onClick={markAllRead}
          className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted/50"
          disabled={pending}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Marker alle som lest
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
          Ingen varsler ennå.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className={`p-5 ${n.read_at ? 'bg-card' : 'bg-indigo-50 dark:bg-indigo-950/40/40'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{n.title}</div>
                    {n.body ? <div className="text-sm text-muted-foreground mt-1">{n.body}</div> : null}
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(n.created_at).toLocaleString('nb-NO')}
                    </div>
                  </div>
                  {n.url ? (
                    <Link
                      href={n.url}
                      className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
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

