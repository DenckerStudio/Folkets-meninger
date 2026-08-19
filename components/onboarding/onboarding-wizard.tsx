'use client';

import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, LockKeyhole, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FadeIn from '@/components/fade-in';
import { OnboardingStepper } from '@/components/onboarding/onboarding-stepper';
import { useAuth } from '@/hooks/use-auth';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import {
  canAdvanceOnboardingStep,
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
import { cn } from '@/lib/utils';

type Direction = 1 | -1;

const fieldClass =
  'mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25';

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
  const [otpVerified, setOtpVerified] = useState(false);
  const [bankIdVerified, setBankIdVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => getOnboardingStep(step), [step]);
  const phoneVerified = otpVerified || (user ? getUserVerificationStatus(user).phoneVerified : false);
  const hasName = firstName.trim().length >= 2 && lastName.trim().length >= 2;
  const canAdvance = canAdvanceOnboardingStep(step, {
    hasName,
    phoneVerified,
    bankIdVerified,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`${routes.login}?next=${encodeURIComponent(routes.onboarding)}`);
      return;
    }

    fetch('/api/user/onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (data.first_name) setFirstName(String(data.first_name));
        if (data.last_name) setLastName(String(data.last_name));
        if (data.verification?.phoneVerified) setOtpVerified(true);
        if (data.onboarding?.bankIdVerified) setBankIdVerified(true);
      })
      .catch(() => {});
  }, [user, loading, router]);

  const goTo = (next: OnboardingStepId | null, dir: Direction) => {
    if (!next) {
      void finish();
      return;
    }
    setDirection(dir);
    setError('');
    setStep(next);
  };

  const finish = async () => {
    if (!phoneVerified || !bankIdVerified) {
      setError('SMS og BankID må bekreftes før du kan fortsette.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(data.error || 'Kunne ikke fullføre onboarding.');
      return;
    }
    const destination = nextPath.startsWith('/dashboard')
      ? `${nextPath}${nextPath.includes('?') ? '&' : '?'}tour=1`
      : utforskWithTour(true);
    router.replace(destination);
    router.refresh();
  };

  const saveName = async (): Promise<boolean> => {
    if (!hasName) {
      setError('Fornavn og etternavn må være minst 2 tegn.');
      return false;
    }
    setBusy(true);
    setError('');
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() }),
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
      setError(updateError.message || 'Kunne ikke sende SMS. Sjekk nummeret og prøv igjen.');
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
      setError('Ugyldig kode. Prøv igjen.');
      return false;
    }
    setOtpVerified(true);
    return true;
  };

  const confirmBankId = () => {
    setBankIdVerified(true);
    setError('');
  };

  const handlePrimary = async () => {
    if (step === 'name') {
      const saved = await saveName();
      if (!saved) return;
    }
    if (step === 'sms') {
      if (!phoneVerified) {
        if (otpSent && otp.trim()) {
          const ok = await verifyOtp();
          if (!ok) return;
        } else {
          setError('Bekreft telefonnummeret med SMS før du fortsetter.');
          return;
        }
      }
    }
    if (step === 'bankid') {
      if (!bankIdVerified) {
        setError('Bekreft med BankID før du fullfører.');
        return;
      }
    }
    goTo(nextOnboardingStepId(step), 1);
  };

  const smsReadyToSubmit = phoneVerified || (otpSent && otp.trim().length >= 4);
  const primaryDisabled =
    busy ||
    (step === 'name' && !canAdvance) ||
    (step === 'sms' && !smsReadyToSubmit) ||
    (step === 'bankid' && !canAdvance);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Laster…</div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <FadeIn delay={0.05}>
        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Onboarding</p>
        </div>
      </FadeIn>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <OnboardingStepper current={step} />

        <div className="mt-8 overflow-hidden">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{current.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {current.description}
          </p>

          <div className="mt-6 min-h-[11rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={reducedMotion ? false : { opacity: 0, x: direction * 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: direction * -16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
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
                {step === 'bankid' ? (
                  <BankIdPanel verified={bankIdVerified} busy={busy} onConfirm={confirmBankId} />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
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
              <span />
            )}
            <Button
              type="button"
              size="lg"
              className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
              onClick={() => void handlePrimary()}
              disabled={primaryDisabled}
            >
              {step === 'bankid' ? 'Fullfør' : 'Fortsett'}
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
      <WelcomeRow index="01" title="Navn" body="Offentlig identitet for høringer." required />
      <WelcomeRow index="02" title="SMS" body="Bekreft telefonnummeret ditt." required />
      <WelcomeRow index="03" title="BankID" body="Bekreft identitet før du deltar." required />
      <WelcomeRow index="04" title="Omvisning" body="Kort gjennomgang av menyen — kan hoppes over." required={false} />
    </ul>
  );
}

function WelcomeRow({
  index,
  title,
  body,
  required,
}: {
  index: string;
  title: string;
  body: string;
  required: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand">
        {index}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {title}
          {required ? (
            <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-brand-accent">
              Påkrevd
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{body}</span>
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
    <div className="grid gap-4 sm:grid-cols-2">
      <OnboardingField
        id="onboarding-first-name"
        label="Fornavn"
        icon={<UserRound className="h-4 w-4" />}
        value={firstName}
        onChange={onFirstName}
        autoComplete="given-name"
      />
      <OnboardingField
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
      <div className="flex items-start gap-3 rounded-xl border border-border bg-brand-soft px-4 py-4 text-sm text-foreground">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <span>Telefonnummeret ditt er bekreftet. Fortsett til BankID.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <OnboardingField
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
          className="rounded-xl"
          onClick={onSend}
          disabled={busy || !phone.trim()}
        >
          Send SMS
        </Button>
      </div>
      {otpSent ? (
        <OnboardingField
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
          Vi bruker nummeret kun til å bekrefte at du er én person. Dette steget kan ikke hoppes over.
        </p>
      )}
    </div>
  );
}

function BankIdPanel({
  verified,
  busy,
  onConfirm,
}: {
  verified: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-brand-soft px-4 py-4 text-sm text-foreground">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <span>BankID er bekreftet. Trykk fullfør for å gå videre til omvisningen.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-5">
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
        <LockKeyhole className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Identitet med BankID</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        BankID er obligatorisk. Bekreft identiteten din her for å sikre én person, én stemme.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-4 rounded-xl bg-brand text-brand-foreground hover:bg-brand/90"
        onClick={onConfirm}
        disabled={busy}
      >
        Bekreft med BankID
      </Button>
    </div>
  );
}

function OnboardingField({
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
      <span className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {label}
      </span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className={cn(fieldClass)}
      />
    </label>
  );
}
