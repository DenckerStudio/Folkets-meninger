'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { PageHeader } from '@/components/page-header';
import { STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';

type Supporter = {
  userId: string;
  email: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
};

type StemmePlusAdminProps = {
  checkoutConfigured: boolean;
};

export function StemmePlusAdmin({ checkoutConfigured: serverCheckoutConfigured }: StemmePlusAdminProps) {
  const [email, setEmail] = useState('');
  const [supporters, setSupporters] = useState<Supporter[]>([]);
  const [checkoutConfigured, setCheckoutConfigured] = useState(serverCheckoutConfigured);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    startTransition(async () => {
      const res = await fetch('/api/admin/stemme-plus', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke hente Stemme+');
        return;
      }
      setSupporters(Array.isArray(data.supporters) ? data.supporters : []);
      setCheckoutConfigured(Boolean(data.checkoutConfigured));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grant = () => {
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke gi Stemme+');
        return;
      }
      setEmail('');
      load();
    });
  };

  const revoke = (supporterEmail: string) => {
    startTransition(async () => {
      setError('');
      const res = await fetch('/api/admin/stemme-plus', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: supporterEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke fjerne Stemme+');
        return;
      }
      load();
    });
  };

  const stripeNotice = checkoutConfigured
    ? ''
    : ' Betaling med Stripe er ikke slått på i dette miljøet.';

  return (
    <div className="space-y-6">
      <PageHeader
        as="h2"
        title="Stemme+"
        description={`Tildel eller fjern Stemme+ (${STEMME_PLUS_MONTHLY_PRICE_NOK} kr/mnd).${stripeNotice}`}
      />

      <p className="text-sm text-muted-foreground">
        Aktive støttespillere: <span className="font-semibold text-foreground">{supporters.length}</span>
        {!checkoutConfigured ? (
          <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
            Stripe ikke konfigurert
          </span>
        ) : null}
      </p>

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
                onClick={() => revoke(supporter.email as string)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Fjern
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {supporters.length === 0 ? (
        <EmptyState
          title="Ingen aktive Stemme+-støttespillere"
          description={
            checkoutConfigured
              ? 'Ingen har Stemme+ ennå. Brukere kan kjøpe via Stripe, eller du kan tildele med e-post under.'
              : 'Tildel medlemskap med e-post under. Selvbetjent Stripe-kasse vises her når nøklene er satt.'
          }
          className="py-8"
        />
      ) : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          grant();
        }}
      >
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="epost@domene.no"
          className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={pending || !email.trim()}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Gi Stemme+
        </button>
      </form>
    </div>
  );
}
