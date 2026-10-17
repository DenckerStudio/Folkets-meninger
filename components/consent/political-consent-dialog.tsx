'use client';

import { useState } from 'react';
import Link from 'next/link';
import { routes } from '@/lib/routes';
import { STANCE_PUBLIC_MIN_ENGAGED } from '@/lib/stances/constants';

type PoliticalConsentDialogProps = {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  requireProfiling?: boolean;
  requireByokActivity?: boolean;
};

export function PoliticalConsentDialog({
  open,
  onClose,
  onAccepted,
  requireProfiling = false,
  requireByokActivity = false,
}: PoliticalConsentDialogProps) {
  const [storage, setStorage] = useState(false);
  const [profiling, setProfiling] = useState(false);
  const [byokActivity, setByokActivity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const canSubmit =
    storage && (!requireProfiling || profiling) && (!requireByokActivity || byokActivity) && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/user/political-consent', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage, profiling, byokActivity }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kunne ikke lagre samtykke.');
        return;
      }
      onAccepted();
    } catch {
      setError('Kunne ikke lagre samtykke. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="political-consent-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 id="political-consent-title" className="text-lg font-semibold text-foreground">
          Samtykke til å lagre dine politiske holdninger
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Når du markerer at du er enig eller uenig i en sak, stemmer i en avstemning eller publiserer en mening,
          sier det noe om dine politiske meninger. Dette er særlige kategorier av personopplysninger etter
          personvernforordningen artikkel 9.
        </p>

        <div className="mt-5 space-y-4">
          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
              checked={storage}
              onChange={(e) => setStorage(e.target.checked)}
            />
            <span>
              Jeg samtykker til at Folkets Meninger lagrer holdningene og stemmene mine på kontoen min, slik at jeg
              kan se historikken min og at de kan telles i anonym statistikk (vises først ved minst{' '}
              {STANCE_PUBLIC_MIN_ENGAGED} svar).
            </span>
          </label>

          <label className="flex gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
              checked={profiling}
              onChange={(e) => setProfiling(e.target.checked)}
            />
            <span>
              Jeg samtykker til at holdningene mine brukes til valgomat, partimatch og forslag til saker.
              (Valgfritt)
            </span>
          </label>

          {requireByokActivity && (
            <label className="flex gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-brand"
                checked={byokActivity}
                onChange={(e) => setByokActivity(e.target.checked)}
              />
              <span>
                Jeg samtykker til at holdningene mine kan sendes til min valgte AI-leverandør når jeg ber chatten
                hente aktiviteten min. (Påkrevd for dette verktøyet)
              </span>
            </label>
          )}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Du kan trekke samtykket tilbake når som helst under Min side → Personvern. Da sletter vi holdninger og
          stemmehistorikk knyttet til samtykket. Les mer i{' '}
          <Link href={routes.personvern} className="font-medium text-brand underline-offset-2 hover:underline">
            personvernerklæringen
          </Link>
          .
        </p>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium"
            onClick={onClose}
            disabled={submitting}
          >
            Ikke nå
          </button>
          <button
            type="button"
            className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            Gi samtykke
          </button>
        </div>
      </div>
    </div>
  );
}
