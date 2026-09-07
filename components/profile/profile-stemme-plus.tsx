'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeartHandshake, Loader2, Sparkles } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { STEMME_PLUS_BENEFITS, STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';

type StemmePlusStatus = {
  tier: 'free' | 'stemme_plus';
  subscription_status: string | null;
  subscription_period_end: string | null;
  monthly_price_nok: number;
};

export function ProfileStemmePlus() {
  const [status, setStatus] = useState<StemmePlusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stemme-plus/status', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Kunne ikke hente status');
      }
      setStatus(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const isActive = status?.tier === 'stemme_plus';
  const price = status?.monthly_price_nok ?? STEMME_PLUS_MONTHLY_PRICE_NOK;

  return (
    <ProfileCard
      title="Stemme+"
      description="Støtt utviklingen av Folkets Stemme — demokratiet forblir gratis for alle."
    >
      <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isActive ? 'Takk for at du støtter oss!' : `Støttemedlemskap — planlagt ${price} kr/mnd`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stemme, utforsk og høringer forblir gratis. Stemme+ gir ekstra fordeler for deg som vil
              følge tettere med.
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {STEMME_PLUS_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            {benefit}
          </li>
        ))}
      </ul>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster status…
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {status && isActive ? (
        <div className="mt-5 space-y-3">
          <StemmePlusBadge size="md" />
          {status.subscription_period_end ? (
            <p className="text-xs text-muted-foreground">
              Gyldig til{' '}
              {new Date(status.subscription_period_end).toLocaleDateString('nb-NO', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Selvbetjent abonnement med Stripe kommer senere. Fordelene er allerede aktive for brukere
          med Stemme+ (f.eks. tildelt av admin til testing).
        </p>
      )}
    </ProfileCard>
  );
}
