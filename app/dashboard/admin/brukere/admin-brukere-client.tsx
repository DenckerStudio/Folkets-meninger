'use client';

import { useEffect, useState, useTransition } from 'react';
import { Users } from 'lucide-react';
import { AdminEmailGrant } from '@/components/admin/admin-email-grant';
import { AdminBackLink } from '@/components/admin/admin-shell';

type AdminsResponse = { admins: { userId: string; email: string | null }[] };

export default function AdminBrukereClient() {
  const [admins, setAdmins] = useState<{ userId: string; email: string | null }[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/roles');
      const data = (await res.json().catch(() => ({}))) as AdminsResponse & { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste administratorer.');
        return;
      }
      setAdmins(data.admins ?? []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const grantAdmin = () => {
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke gi admin-rolle');
        return;
      }
      setEmail('');
      load();
    });
  };

  const revokeAdmin = (adminEmail: string) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke fjerne admin-rolle');
        return;
      }
      load();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users className="h-5 w-5 text-brand" aria-hidden />
          Brukere
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Roller lagres i databasen. Gi eller fjern admin-tilgang med e-post.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {admins.map((admin) => (
          <li
            key={admin.userId}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2"
          >
            <span className="text-sm text-foreground">{admin.email || admin.userId}</span>
            {admin.email ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => revokeAdmin(admin.email as string)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Fjern
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {admins.length === 0 && !pending ? (
        <p className="text-sm text-muted-foreground">Ingen administratorer funnet.</p>
      ) : null}

      <AdminEmailGrant
        value={email}
        onChange={setEmail}
        onSubmit={grantAdmin}
        pending={pending}
        placeholder="epost@domene.no"
        submitLabel="Gi admin"
      />

      <AdminBackLink />
    </div>
  );
}
