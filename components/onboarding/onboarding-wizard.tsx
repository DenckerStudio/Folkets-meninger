'use client';

import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { LockKeyhole, Phone, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FadeIn from '@/components/fade-in';
import { OnboardingStepper } from '@/components/onboarding/onboarding-stepper';
import { useAuth } from '@/hooks/use-auth';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  getOnboardingStep,
  nextOnboardingStepId,
  normalizePhoneNumber,
  previousOnboardingStepId,
  utforskWithTour,
  type OnboardingStepId,
} from '@/lib/onboarding';
import { routes } from '@/lib/routes';
import { sanitizePostLoginPath } from '@/lib/safe-redirect';
import { getBrowserSupabase } from '@/lib/supabase';
import { getUserVerificationStatus } from '@/lib/user-verification';

type Direction = 1 | -1;

export function OnboardingWizard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizePostLoginPath(searchParams.get('next'));
  const reducedMotion = usePrefersReducedMotion();

  const [step, setStep] = useState<OnboardingStepId>('welcome');
  const [direction, setDirection] = useState<Direction>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  const current = useMemo(() => getOnboardingStep(step), [step]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`${routes.login}?next=${encodeURIComponent(routes.onboarding)}`);
      return;
    }

    setPhoneVerified(getUserVerificationStatus(user).phoneVerified);

    fetch('/api/user/onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (data.first_name) setFirstName(String(data.first_name));
        if (data.last_name) setLastName(String(data.last_name));
        if (data.verification?.phoneVerified) setPhoneVerified(true);
      })
      .catch(() => {});
  }, [user, loading, router]);

  const goTo = (next: OnboardingStepId | null, dir: Direction) => {
    if (!next) {
      void finish('complete');
      return;
    }
    setDirection(dir);
    setError('');
    setStep(next);
  };

  const finish = async (action: 'complete' | 'skip') => {
    setBusy(true);
    setError('');
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Continue to dashboard even if persistence fails.
    }
    const destination = nextPath.startsWith('/dashboard')
      ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}tour=1`
      : utforskWithTour(true);
    router.replace(destination);
    router.refresh();
  };

  const saveName = async (): Promise<boolean> => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (first.length < 2 || last.length < 2) {
      setError('Fornavn og etternavn må være minst 2 tegn.');
      return false;
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: first, last_name: last }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Kunne ikke lagre navn.');
      return false;
    }
    return true;
  };

  const sendOtp = async () => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      setError('Skriv inn et gyldig norsk nummer, for eksempel +47 412 34 567.');
      return;
    }
    if (!user) return;
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
    setBusy(false);
    if (updateError) {
      setError(updateError.message || 'Kunne ikke sende SMS. Du kan hoppe over og gjøre det senere.');
      return;
    }
    setPhone(normalized);
    setOtpSent(true);
  };

  const verifyOtp = async (): Promise<boolean> => {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized || !otp.trim()) {
      setError('Skriv inn koden fra SMS.');
      return false;
    }
    setBusy(true);
    setError('');
    const supabase = getBrowserSupabase();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: otp.trim(),
      type: 'phone_change',
    });
    setBusy(false);
    if (verifyError) {
      setError('Ugyldig kode. Prøv igjen, eller hopp over.');
      return false;
    }
    setPhoneVerified(true);
    return true;
  };

  const handlePrimary = async () => {
    if (step === 'name') {
      const saved = await saveName();
      if (!saved) return;
    }
    if (step === 'sms' && otpSent && otp && !phoneVerified) {
      const ok = await verifyOtp();
      if (!ok) return;
    }
    goTo(nextOnboardingStepId(step), 1);
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm uppercase tracking-[0.2em] text-muted-foreground">
        Laster
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl border border-foreground/20 bg-card">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-accent" aria-hidden />
      <OnboardingStepper current={step} />

      <div className="overflow-hidden px-6 py-8 sm:px-10 sm:py-12">
        <p className="font-mono text-5xl font-light leading-none text-brand-accent/80 sm:text-7xl">
          {current.index.toString().padStart(2, '0')}
        </p>
        <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {current.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {current.description}
        </p>

        <div className="mt-8 min-h-[12rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reducedMotion ? false : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {step === 'welcome' ? <WelcomePanel /> : null}
              {step === 'name' ? (
                <NamePanel
                  firstName={firstName}
                  lastName={lastName}
                  onFirstName={setFirstName}
                  onLastName={setLastName}
                />
              ) : null}
              {step === 'sms' ? (
                <SmsPanel
                  phone={phone}
                  otp={otp}
                  otpSent={otpSent}
                  verified={phoneVerified}
                  busy={busy}
                  onPhone={setPhone}
                  onOtp={setOtp}
                  onSend={sendOtp}
                />
              ) : null}
              {step === 'bankid' ? <BankIdPanel /> : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {error ? (
          <p className="mt-4 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 border-t border-foreground/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {previousOnboardingStepId(step) ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-none uppercase tracking-[0.14em]"
                onClick={() => goTo(previousOnboardingStepId(step), -1)}
                disabled={busy}
              >
                Tilbake
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="rounded-none bg-brand text-brand-foreground uppercase tracking-[0.14em] hover:bg-brand/90"
              onClick={() => void handlePrimary()}
              disabled={busy}
            >
              {step === 'bankid' ? 'Fullfør' : 'Fortsett'}
            </Button>
          </div>
          <button
            type="button"
            className="text-left text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
            onClick={() => void finish('skip')}
            disabled={busy}
          >
            Hopp over
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomePanel() {
  return (
    <FadeIn>
      <ul className="grid gap-0 border border-foreground/15">
        <WelcomeRow index="01" title="Navn" body="Offentlig identitet for høringer." />
        <WelcomeRow index="02" title="SMS" body="Valgfri bekreftelse av telefonnummer." />
        <WelcomeRow index="03" title="BankID" body="Kommer senere. Kan hoppes over nå." />
      </ul>
    </FadeIn>
  );
}

function WelcomeRow({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[4rem_1fr] items-baseline gap-4 border-b border-foreground/15 px-4 py-3 last:border-b-0">
      <span className="font-mono text-sm text-brand-accent">{index}</span>
      <span>
        <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
      </span>
    </li>
  );
}

function NamePanel({
  firstName,
  lastName,
  onFirstName,
  onLastName,
}: {
  firstName: string;
  lastName: string;
  onFirstName: (value: string) => void;
  onLastName: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <SwissField
        id="onboarding-first-name"
        label="Fornavn"
        icon={<UserRound className="h-4 w-4" />}
        value={firstName}
        onChange={onFirstName}
        autoComplete="given-name"
      />
      <SwissField
        id="onboarding-last-name"
        label="Etternavn"
        value={lastName}
        onChange={onLastName}
        autoComplete="family-name"
      />
    </div>
  );
}

function SmsPanel({
  phone,
  otp,
  otpSent,
  verified,
  busy,
  onPhone,
  onOtp,
  onSend,
}: {
  phone: string;
  otp: string;
  otpSent: boolean;
  verified: boolean;
  busy: boolean;
  onPhone: (value: string) => void;
  onOtp: (value: string) => void;
  onSend: () => void;
}) {
  if (verified) {
    return (
      <p className="border border-foreground/15 px-4 py-5 text-sm text-foreground">
        Telefonnummeret ditt er allerede bekreftet. Fortsett, eller hopp videre.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SwissField
            id="onboarding-phone"
            label="Telefonnummer"
            icon={<Phone className="h-4 w-4" />}
            value={phone}
            onChange={onPhone}
            autoComplete="tel"
            inputMode="tel"
            placeholder="+47 412 34 567"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="rounded-none uppercase tracking-[0.14em]"
          onClick={onSend}
          disabled={busy || !phone.trim()}
        >
          Send SMS
        </Button>
      </div>
      {otpSent ? (
        <SwissField
          id="onboarding-otp"
          label="Kode fra SMS"
          value={otp}
          onChange={onOtp}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Vi bruker nummeret kun til å bekrefte at du er én person. Du kan hoppe over dette steget.
        </p>
      )}
    </div>
  );
}

function BankIdPanel() {
  return (
    <div className="border border-foreground/15 p-6">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center border border-foreground/20 text-brand">
        <LockKeyhole className="h-5 w-5" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-accent">Kommer senere</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">BankID er ikke tilgjengelig ennå</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Når BankID er på plass, kan du bekrefte identitet herfra eller under Min side. Ingenting er låst i mellomtiden:
        du kan utforske saker, stemme og komme tilbake.
      </p>
    </div>
  );
}

function SwissField({
  id,
  label,
  value,
  onChange,
  icon,
  autoComplete,
  inputMode,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-none border-0 border-b border-foreground/30 bg-transparent px-0 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-brand-accent"
      />
    </label>
  );
}
