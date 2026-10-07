'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeartHandshake, Loader2 } from 'lucide-react';
import { useChatOverlay } from '@/components/chat/chat-overlay-context';
import { EmptyState } from '@/components/dashboard/empty-state';
import { CivicTick } from '@/components/icons/civic';
import { ByokSettings, type ByokMetaView } from '@/components/profile/byok-settings';
import { ProfileCard } from '@/components/profile/profile-card';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { Button } from '@/components/ui/button';
import { STEMME_PLUS_BENEFITS, STEMME_PLUS_MONTHLY_PRICE_NOK } from '@/lib/stemme-plus/constants';
import type { LlmProvider } from '@/lib/byok/providers';

type StemmePlusStatus = {
  tier: 'free' | 'stemme_plus';
  subscription_status: string | null;
  subscription_period_end: string | null;
  monthly_price_nok: number;
  checkout_configured: boolean;
  has_stripe_customer: boolean;
  byok_encryption_ready: boolean;
  has_byok: boolean;
  byok: { provider: LlmProvider; model: string; key_last4: string } | null;
};

export function ProfileStemmePlus() {
  const { openChat } = useChatOverlay();
  const [status, setStatus] = useState<StemmePlusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

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
  const checkoutConfigured = status?.checkout_configured ?? false;

  const startCheckout = async () => {
    setCheckoutBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stemme-plus/checkout', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke starte betaling');
      }
      if (typeof json.url === 'string') {
        window.location.href = json.url;
        return;
      }
      throw new Error('Stripe returnerte ingen betalingsside');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke starte betaling');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const openPortal = async () => {
    setCheckoutBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stemme-plus/portal', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Kunne ikke åpne kundeportal');
      }
      if (typeof json.url === 'string') {
        window.location.href = json.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke åpne kundeportal');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const byokInitial: ByokMetaView = status?.byok
    ? {
        provider: status.byok.provider,
        model: status.byok.model,
        keyLast4: status.byok.key_last4,
      }
    : null;

  return (
    <ProfileCard
      title="Stemme+"
      description="Støtt utviklingen av Folkets Stemme — demokratiet forblir gratis for alle."
    >
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isActive ? 'Takk for at du støtter oss!' : `Støttemedlemskap — ${price} kr/mnd`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Stemme, utforsk og høringer forblir gratis. Stemme+ gir merker, rikere varsler og
              Chat med din egen nøkkel.
            </p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {STEMME_PLUS_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-sm text-foreground">
            <CivicTick className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {benefit}
          </li>
        ))}
      </ul>

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster status…
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {status && isActive ? (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StemmePlusBadge size="md" />
            <button
              type="button"
              onClick={() => openChat()}
              className="text-sm font-medium text-brand hover:underline"
            >
              Åpne chat
            </button>
          </div>
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
          {status.has_stripe_customer ? (
            <Button type="button" variant="outline" onClick={() => void openPortal()} disabled={checkoutBusy}>
              Administrer abonnement
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Medlemskapet er aktivt (tildelt eller via Stripe når det er satt opp).
            </p>
          )}
          <ByokSettings
            encryptionReady={status.byok_encryption_ready}
            initial={byokInitial}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {checkoutConfigured ? (
            <Button type="button" onClick={() => void startCheckout()} disabled={checkoutBusy}>
              {checkoutBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Bli Stemme+ — {price} kr/mnd
            </Button>
          ) : (
            <EmptyState
              className="py-6"
              title="Stripe-kasse er ikke konfigurert ennå"
              description={`Selvbetjent betaling via Vercel Marketplace → Stripe kommer når nøklene er satt (${price} kr/mnd). Fordelene er allerede aktive for brukere med Stemme+ (for eksempel tildelt av admin).`}
            />
          )}
        </div>
      )}
    </ProfileCard>
  );
}
