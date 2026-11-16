'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ProfileCard } from '@/components/profile/profile-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { accountDeleteConfirmationMatches, normalizeAccountDeleteConfirmation } from '@/lib/account-delete/confirmation';
import { ACCOUNT_DELETE_CONFIRMATION_TOKEN } from '@/lib/account-delete/constants';
import type { SelfDeleteBlockReason } from '@/lib/account-delete/eligibility';
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

type EligibilityState = {
  loading: boolean;
  allowed: boolean;
  reason?: SelfDeleteBlockReason;
  message?: string;
};

export function DeleteAccountSettings() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<EligibilityState>({
    loading: true,
    allowed: true,
  });

  const normalizedConfirmation = useMemo(
    () => normalizeAccountDeleteConfirmation(confirmation),
    [confirmation],
  );

  const canSubmit =
    eligibility.allowed &&
    accountDeleteConfirmationMatches(confirmation) &&
    !submitting;

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/user/delete-account', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setEligibility({ loading: false, allowed: true });
          return;
        }
        setEligibility({
          loading: false,
          allowed: json.allowed !== false,
          reason: json.reason,
          message: typeof json.message === 'string' ? json.message : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setEligibility({ loading: false, allowed: true });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onDelete = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: normalizedConfirmation }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.reason === 'stemme_plus' || json?.reason === 'last_admin') {
          setEligibility({
            loading: false,
            allowed: false,
            reason: json.reason,
            message: typeof json?.error === 'string' ? json.error : undefined,
          });
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

  const showConfirmationForm = !eligibility.loading && eligibility.allowed;

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

        {eligibility.loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Sjekker om kontoen kan slettes…
          </p>
        ) : null}

        {!eligibility.loading && !eligibility.allowed ? (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground" role="status">
            <p>{eligibility.message}</p>
            {eligibility.reason === 'stemme_plus' ? (
              <p className="mt-3">
                <Link
                  href={`${routes.minSide}?tab=stemme-plus`}
                  className="min-h-11 inline-flex items-center font-medium text-brand underline-offset-4 hover:underline"
                >
                  Gå til Stemme+ og abonnement
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="space-y-2 text-sm text-destructive" role="alert">
            <p>{error}</p>
            <p>
              <Link href={routes.innspill} className="font-medium text-brand underline-offset-4 hover:underline">
                Kontakt oss
              </Link>
              {' · '}
              <Link href={routes.personvern} className="font-medium text-brand underline-offset-4 hover:underline">
                Personvern
              </Link>
            </p>
          </div>
        ) : null}

        {showConfirmationForm ? (
          <>
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
          </>
        ) : null}
      </div>
    </ProfileCard>
  );
}