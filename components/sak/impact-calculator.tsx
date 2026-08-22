'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { Calculator, Loader2, MapPin, Car, Home, Briefcase, CircleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { readLocalStorage, writeLocalStorage } from '@/lib/preferences/local-storage';
import { PREFERENCE_KEYS } from '@/lib/preferences/keys';
import {
  CAR_OPTIONS,
  HOUSING_OPTIONS,
  NORWAY_COUNTIES,
  OCCUPATION_OPTIONS,
  hasAnyImpactParam,
  parseImpactProfile,
} from '@/lib/impact/profile';
import { formatKr } from '@/lib/impact/money';
import { EMPTY_IMPACT_PROFILE, type ImpactProfile, type ImpactResult } from '@/lib/impact/types';
import { cn } from '@/lib/utils';

function Chip({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-sm transition-colors',
        selected
          ? 'border-brand bg-brand text-brand-foreground shadow-sm'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function confidenceLabel(value: ImpactResult['confidence']): string {
  switch (value) {
    case 'high':
      return 'Høy treffsikkerhet';
    case 'medium':
      return 'Middels treffsikkerhet';
    case 'low':
      return 'Usikkert anslag';
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

function amountTone(result: ImpactResult): string {
  const benefit = result.amountKind === 'benefit';
  if (result.direction === 'increase') {
    return benefit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300';
  }
  if (result.direction === 'decrease') {
    return benefit ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300';
  }
  return 'text-foreground';
}

export function ImpactCalculator({ sakId }: { sakId: string }) {
  const headingId = useId();
  const showTooltips = useSakTooltipsEnabled();
  const [profile, setProfile] = useState<ImpactProfile>(EMPTY_IMPACT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = parseImpactProfile(readLocalStorage<unknown>(PREFERENCE_KEYS.impact.profile));
    setProfile(stored);
    setHydrated(true);
  }, []);

  const calculate = useCallback(
    async (nextProfile: ImpactProfile) => {
      if (!hasAnyImpactParam(nextProfile)) {
        setResult(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sak/${encodeURIComponent(sakId)}/impact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextProfile),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke beregne effekten.');
          setResult(null);
          return;
        }
        setResult(json as ImpactResult);
      } catch {
        setError('Kunne ikke beregne effekten akkurat nå.');
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [sakId],
  );

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void calculate(profile);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [hydrated, profile, calculate]);

  function update<K extends keyof ImpactProfile>(key: K, value: ImpactProfile[K]) {
    setProfile((prev) => {
      const next = { ...prev, [key]: prev[key] === value ? null : value };
      writeLocalStorage(PREFERENCE_KEYS.impact.profile, next);
      return next;
    });
  }

  const showAmount = result?.annualAmountKr != null && result.annualAmountKr > 0;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-8"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
          <Calculator className="h-6 w-6 text-brand" aria-hidden />
          Hva betyr saken for deg?
          {showTooltips ? (
            <InfoTooltip
              label="konsekvens-kalkulatoren"
              description={SAK_META_TOOLTIPS.konsekvensKalkulator}
              side="bottom"
            />
          ) : null}
        </h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Velg noen anonyme opplysninger. De lagres bare på denne enheten, og brukes til å slå saken opp mot
        dokumentene og AI-sammendraget.
      </p>

      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
            Fylke
          </legend>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={profile.fylkeCode ?? ''}
            onChange={(event) =>
              setProfile((prev) => {
                const next = { ...prev, fylkeCode: event.target.value || null };
                writeLocalStorage(PREFERENCE_KEYS.impact.profile, next);
                return next;
              })
            }
          >
            <option value="">Velg fylke</option>
            {NORWAY_COUNTIES.map((county) => (
              <option key={county.code} value={county.code}>
                {county.name}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Home className="h-4 w-4 text-muted-foreground" aria-hidden />
            Bolig
          </legend>
          <div className="flex flex-wrap gap-2">
            {HOUSING_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={profile.housing === option.value}
                onClick={() => update('housing', option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Car className="h-4 w-4 text-muted-foreground" aria-hidden />
            Bil
          </legend>
          <div className="flex flex-wrap gap-2">
            {CAR_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={profile.hasCar === option.value}
                onClick={() => update('hasCar', option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden />
            Livssituasjon
          </legend>
          <div className="flex flex-wrap gap-2">
            {OCCUPATION_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                selected={profile.occupation === option.value}
                onClick={() => update('occupation', option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-6" aria-live="polite">
        {!hasAnyImpactParam(profile) ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
            Velg minst én opplysning for å se den personlige effekten. Hvis kilden ikke har tall, viser vi likevel
            hvem saken treffer.
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Slår opp i saksdokumentene …
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        <AnimatePresence>
          {result && hasAnyImpactParam(profile) && !loading ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-xl border border-border bg-muted/30 p-5"
            >
              {showAmount ? (
                <p className={`text-3xl font-bold tracking-tight ${amountTone(result)}`}>
                  {result.direction === 'decrease' ? '−' : result.direction === 'increase' ? '+' : ''}
                  {formatKr(result.annualAmountKr ?? 0)}
                  <span className="ml-2 text-base font-medium text-muted-foreground">i året</span>
                </p>
              ) : null}

              <p className="text-base font-semibold leading-relaxed text-foreground">{result.headline}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{result.personalSummary}</p>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground ring-1 ring-border">
                  {confidenceLabel(result.confidence)}
                </span>
                {result.sourcesUsed > 0 ? (
                  <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground ring-1 ring-border">
                    {result.sourcesUsed} dokumentutdrag
                  </span>
                ) : (
                  <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground ring-1 ring-border">
                    Basert på AI-sammendrag
                  </span>
                )}
              </div>

              {result.effects.filter((effect) => effect.appliesToUser).length > 0 ? (
                <ul className="space-y-2">
                  {result.effects
                    .filter((effect) => effect.appliesToUser)
                    .slice(0, 3)
                    .map((effect) => (
                      <li
                        key={effect.id}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      >
                        <span className="font-medium">{effect.audienceLabel}: </span>
                        {effect.summary}
                      </li>
                    ))}
                </ul>
              ) : null}

              <p className="text-xs leading-relaxed text-muted-foreground">{result.disclaimer}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
