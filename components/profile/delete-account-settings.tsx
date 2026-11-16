'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ACCOUNT_DELETE_CONFIRMATION_TOKEN } from '@/lib/account-delete/constants';
import { routes } from '@/lib/routes';

const DELETED_ITEMS = [
  'Profil, navn, e-post, bio og profilbilde',
  'Holdninger, valgomat og koblingen til stortingsstemmer og poll-stemmer',
  'Meninger, innspill, høringskommentarer og innbyggerforslag du har publisert',
  'Varsler, e-postpreferanser og hjertesak-varsler',
  'BYOK-nøkkel og andre Stemme+-innstillinger lagret hos oss',
  'Chat- og bruksdata knyttet til kontoen',
  'Poeng, merker og quiz- og lesehistorikk',
] as const;

const KEPT_ANONYMOUS = [
  'Anonyme stemmetall i statistikk (uten kobling til deg)',
  'Regnskaps-/betalingsposter hos Stripe etter gjeldende lagringsplikt',
] as const;

export function DeleteAccountSettings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blockingReason, setBlockingReason] = useState<'stemme_plus' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = confirmation === ACCOUNT_DELETE_CONFIRMATION_TOKEN && !submitting;

  const onDelete = async () => {
    if (!canSubmit) return;
    setError(null);
    setBlockingReason(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: ACCOUNT_DELETE_CONFIRMATION_TOKEN }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.reason === 'stemme_plus') {
          setBlockingReason('stemme_plus');
        }
        setError(typeof json?.error === 'string' ? json.error : 'Kunne ikke slette kontoen');
        return;
      }
      const redirectTo =
        typeof json?.redirectTo === 'string' ? json.redirectTo : `${routes.home}?konto-slettet=1`;
      await signOut();
      router.replace(redirectTo);
    } catch {
      setError('Kunne ikke slette kontoen. Prøv igjen om litt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileCard
      title="Slett kontoen min"
      description="Permanent sletting i tråd med GDPR. Dette kan ikke angres."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0 space-y-3 text-sm">
              <p className="font-medium text-foreground">Dette slettes:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {DELETED_ITEMS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="font-medium text-foreground">Beholdes uten personkobling:</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {KEPT_ANONYMOUS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {blockingReason === 'stemme_plus' ? (
          <p className="text-sm text-foreground">
            <Link
              href={`${routes.minSide}?tab=stemme-plus`}
              className="min-h-11 inline-flex items-center font-medium text-brand underline-offset-4 hover:underline"
            >
              Gå til Stemme+ og abonnement
            </Link>
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="delete-account-confirm" className="text-sm font-medium text-foreground">
            Skriv {ACCOUNT_DELETE_CONFIRMATION_TOKEN} for å bekrefte
          </label>
          <Input
            id="delete-account-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 max-w-xs font-mono uppercase"
            disabled={submitting}
          />
        </div>

        <Button
          type="button"
          variant="destructive"
          className="min-h-11 w-full sm:w-auto"
          disabled={!canSubmit}
          onClick={onDelete}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Sletter…
            </>
          ) : (
            'Slett kontoen min permanent'
          )}
        </Button>
      </div>
    </ProfileCard>
  );
}