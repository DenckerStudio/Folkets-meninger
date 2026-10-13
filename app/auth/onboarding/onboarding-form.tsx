'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Heart, MapPin, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FadeIn from '@/components/fade-in';
import { OnboardingStepper } from '@/components/onboarding/onboarding-stepper';
import { useAuth } from '@/hooks/use-auth';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  getOnboardingStep,
  INTEREST_AREAS,
  nextOnboardingStepId,
  ONBOARDING_PATH,
  postOnboardingDestination,
  previousOnboardingStepId,
  type OnboardingStepId,
} from '@/lib/onboarding';
import { NORWAY_COUNTIES } from '@/lib/polls/norway-counties';
import { loginWithNext, sanitizePostLoginPath } from '@/lib/safe-redirect';
import { cn } from '@/lib/utils';

type Direction = 1 | -1;

export function OnboardingForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizePostLoginPath(searchParams.get('next'));
  const reducedMotion = usePrefersReducedMotion();

  const [step, setStep] = useState<OnboardingStepId>('welcome');
  const [direction, setDirection] = useState<Direction>(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [fylkeCode, setFylkeCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => getOnboardingStep(step), [step]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(loginWithNext(ONBOARDING_PATH));
      return;
    }

    fetch('/api/user/onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (data.needs_onboarding === false) {
          router.replace(postOnboardingDestination(nextPath));
        }
      })
      .catch(() => {});

    fetch('/api/notifications/categories', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.categories)) setInterests(json.categories);
      })
      .catch(() => {});

    fetch('/api/user/profile', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (typeof json.fylke_code === 'string') setFylkeCode(json.fylke_code);
      })
      .catch(() => {});
  }, [user, loading, router, nextPath]);

  const toggleInterest = (area: string) => {
    setInterests((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area],
    );
  };

  const saveInterests = async (): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/notifications/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: interests }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Kunne ikke lagre hjertesaker.');
        return false;
      }
      return true;
    } catch {
      setError('En feil oppstod. Prøv igjen.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveFylke = async (): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fylke_code: fylkeCode || null }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Kunne ikke lagre fylke.');
        return false;
      }
      return true;
    } catch {
      setError('En feil oppstod. Prøv igjen.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const complete = async (options?: { startTour?: boolean }) => {
    setBusy(true);
    setError('');
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      router.replace(postOnboardingDestination(nextPath, { startTour: options?.startTour }));
      router.refresh();
    } catch {
      setError('Kunne ikke fullføre. Prøv igjen.');
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
    } catch {
      // continue regardless
    }
    router.replace(postOnboardingDestination(nextPath));
    router.refresh();
  };

  const goTo = (next: OnboardingStepId | null, dir: Direction) => {
    setDirection(dir);
    setError('');
    if (next) setStep(next);
  };

  const handlePrimary = async () => {
    if (step === 'welcome') {
      goTo(nextOnboardingStepId(step), 1);
      return;
    }
    if (step === 'interests') {
      const ok = await saveInterests();
      if (!ok) return;
      goTo(nextOnboardingStepId(step), 1);
      return;
    }
    // fylke
    const ok = await saveFylke();
    if (!ok) return;
    await complete({ startTour: true });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Laster…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <FadeIn delay={0.05}>
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
            Folkets Meninger
          </p>
        </div>
      </FadeIn>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <OnboardingStepper current={step} />

        <div className="mt-8 overflow-hidden">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {current.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {current.description}
          </p>

          <div className="mt-6 min-h-[12rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reducedMotion ? false : { opacity: 0, x: direction * 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: direction * -16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {step === 'welcome' ? <WelcomePanel /> : null}
                {step === 'interests' ? (
                  <InterestsPanel selected={interests} onToggle={toggleInterest} />
                ) : null}
                {step === 'fylke' ? (
                  <FylkePanel value={fylkeCode} onChange={setFylkeCode} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-6">
            {previousOnboardingStepId(step) ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-xl"
                onClick={() => goTo(previousOnboardingStepId(step), -1)}
                disabled={busy}
              >
                Tilbake
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-xl text-muted-foreground"
                onClick={() => void skip()}
                disabled={busy}
              >
                Hopp over
              </Button>
            )}
            <Button
              type="button"
              size="lg"
              className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => void handlePrimary()}
              disabled={busy}
            >
              {step === 'fylke' ? 'Fullfør og vis omvisning' : 'Fortsett'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomePanel() {
  return (
    <ul className="space-y-2">
      <WelcomeRow
        index="01"
        title="Hjertesaker"
        body="Velg saksområdene du vil følge og få varsler om."
        icon={<Heart className="h-4 w-4" />}
      />
      <WelcomeRow
        index="02"
        title="Fylke"
        body="Valgfritt – gir deg lokale tall i avstemninger."
        icon={<MapPin className="h-4 w-4" />}
      />
      <li className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            Til slutt: en kort omvisning
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Utforsk, Reels, varsler og Stemme+-chatten. Du kan hoppe over når som helst.
          </span>
        </span>
      </li>
    </ul>
  );
}

function WelcomeRow({
  index,
  title,
  body,
  icon,
}: {
  index: string;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">
          {index} · {title}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
      </span>
    </li>
  );
}

function InterestsPanel({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (area: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {INTEREST_AREAS.map((area) => {
        const active = selected.includes(area);
        return (
          <button
            key={area}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(area)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
              active
                ? 'border-brand bg-brand/10 text-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted/50',
            )}
          >
            <span className="text-sm font-medium">{area}</span>
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                active ? 'border-brand bg-brand text-brand-foreground' : 'border-border',
              )}
              aria-hidden
            >
              {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FylkePanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        Fylke
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full max-w-sm rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
      >
        <option value="">Vil ikke oppgi</option>
        {NORWAY_COUNTIES.map((county) => (
          <option key={county.code} value={county.code}>
            {county.name}
          </option>
        ))}
      </select>
    </label>
  );
}


