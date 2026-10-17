'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProfileCard } from '@/components/profile/profile-card';
import { routes } from '@/lib/routes';
import type { PoliticalConsentState } from '@/lib/consent/political-consent';

type PoliticalConsentSettingsProps = {
  userId: string;
};

export function PoliticalConsentSettings({ userId }: PoliticalConsentSettingsProps) {
  const [state, setState] = useState<PoliticalConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/political-consent', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) {
        setState(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, userId]);

  async function handleWithdrawAll() {
    if (!confirm('Dette trekker samtykket og sletter lagrede holdninger og stemmehistorikk. Fortsette?')) {
      return;
    }
    setWithdrawing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/user/political-consent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw_all' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof data.error === 'string' ? data.error : 'Kunne ikke trekke samtykke.');
        return;
      }
      setState(data);
      setMessage('Samtykke er trukket og politiske holdningsdata er slettet.');
    } catch {
      setMessage('Kunne ikke trekke samtykke. Prøv igjen.');
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <ProfileCard
      title="Samtykke til politiske holdninger"
      description="Uttrykkelig samtykke etter GDPR art. 9. Du kan trekke det tilbake — da stopper videre behandling og lagrede holdninger slettes."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Laster samtykke …</p>
      ) : (
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Lagring av holdninger og stemmer: {state?.storage ? 'Ja' : 'Nei'}</li>
          <li>Valgomat og partimatch: {state?.profiling ? 'Ja' : 'Nei'}</li>
          <li>Holdningsdata i AI-chat (BYOK): {state?.byokActivity ? 'Ja' : 'Nei'}</li>
          {state?.textVersion && <li className="text-xs">Tekstversjon: {state.textVersion}</li>}
        </ul>
      )}

      {message && <p className="mt-3 text-sm text-foreground">{message}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => void handleWithdrawAll()}
          disabled={withdrawing || loading || !state?.storage}
        >
          Trekk samtykke og slett holdningsdata
        </button>
        <Link
          href={routes.personvern}
          className="min-h-11 inline-flex items-center text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          Les personvernerklæringen
        </Link>
      </div>
    </ProfileCard>
  );
}
