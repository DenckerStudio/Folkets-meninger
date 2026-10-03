'use client';

import { useEffect, useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { AdminEmailGrant } from '@/components/admin/admin-email-grant';
import { AdminBackLink } from '@/components/admin/admin-shell';

type SupportersResponse = {
  supporters: { userId: string; email: string | null; subscriptionStatus: string | null }[];
};

export default function AdminStemmePlusClient() {
  const [supporters, setSupporters] = useState<{ userId: string; email: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus');
      const data = (await res.json().catch(() => ({}))) as SupportersResponse & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste Stemme+.');
        return;
      }
      setSupporters(
        (data.supporters ?? []).map((row) => ({
          userId: row.userId,
          email: row.email,
        })),
      );
    });
  };

  useEffect(() => {
    load();
  }, []);

  const grantStemmePlus = () => {
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke gi Stemme+');
        return;
      }
      setEmail('');
      load();
    });
  };

  const revokeStemmePlus = (supporterEmail: string) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supporterEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke fjerne Stemme+');
        return;
      }
      load();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Star className="h-5 w-5 text-brand" aria-hidden />
          Stemme+
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gi eller fjern støttemedlemskap manuelt. Stripe-betaling er ikke en del av dette verktøyet.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {supporters.map((supporter) => (
          <li
            key={supporter.userId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
          >
            <span className="text-sm text-foreground">{supporter.email || supporter.userId}</span>
            {supporter.email ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => revokeStemmePlus(supporter.email as string)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Fjern
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {supporters.length === 0 && !pending ? (
        <p className="text-sm text-muted-foreground">Ingen aktive Stemme+-støttespillere.</p>
      ) : null}

      <AdminEmailGrant
        value={email}
        onChange={setEmail}
        onSubmit={grantStemmePlus}
        pending={pending}
        placeholder="epost@domene.no"
        submitLabel="Gi Stemme+"
      />

      <AdminBackLink />
    </div>
  );
}
