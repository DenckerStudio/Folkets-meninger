'use client';

import { useState, type FormEvent } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { useRouter, useSearchParams } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase';
import { buildOnboardingUserMetadata, hasIncompleteOnboarding, onboardingPathWithNext } from '@/lib/onboarding';
import { routes } from '@/lib/routes';
import { sanitizePostLoginPath } from '@/lib/safe-redirect';

export default function LoginClient() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizePostLoginPath(searchParams.get('next'));
  const supabase = getBrowserSupabase();

  const continueAfterAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const res = await fetch('/api/user/onboarding');
    const data = await res.json().catch(() => ({}));
    const needs =
      typeof data.needs_onboarding === 'boolean'
        ? data.needs_onboarding
        : hasIncompleteOnboarding(user);
    if (needs) {
      router.push(onboardingPathWithNext(nextPath));
    } else {
      router.push(nextPath.startsWith('/auth/') ? routes.utforsk : nextPath);
    }
    router.refresh();
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isRegister) {
        const trimmedFirst = firstName.trim();
        const trimmedLast = lastName.trim();
        if (trimmedFirst.length < 2 || trimmedLast.length < 2) {
          setError('Fornavn og etternavn må være minst 2 tegn.');
          setIsLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: trimmedFirst,
              last_name: trimmedLast,
              full_name: `${trimmedFirst} ${trimmedLast}`,
              ...buildOnboardingUserMetadata({ pending: true }),
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          setIsLoading(false);
          return;
        }
        if (!data.session) {
          setPendingEmailConfirm(true);
          setIsLoading(false);
          return;
        }
        router.push(onboardingPathWithNext(nextPath));
        router.refresh();
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }
      await continueAfterAuth();
    } catch {
      setError('En uventet feil oppstod.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  if (pendingEmailConfirm) {
    return (
      <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <FadeIn delay={0.1}>
          <div className="sm:mx-auto sm:w-full sm:max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Registrering</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">Sjekk e-posten din</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Vi har sendt en bekreftelse til {email}. Når du har bekreftet, logger du inn og fortsetter onboarding med SMS og BankID.
            </p>
            <button
              type="button"
              className="mt-6 text-sm font-medium text-brand hover:underline"
              onClick={() => {
                setPendingEmailConfirm(false);
                setIsRegister(false);
              }}
            >
              Tilbake til innlogging
            </button>
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <FadeIn delay={0.1}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <ShieldCheck className="h-8 w-8" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-foreground">
            {isRegister ? 'Opprett konto' : 'Logg inn'}
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {isRegister ? 'Etter registrering bekrefter du med SMS og BankID. Omvisningen starter på dashbordet.' : 'Tilgang til saker, høringer og stemmegivning.'}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-3xl border border-border bg-card px-4 py-8 shadow-sm sm:px-10">
            {error && (
              <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mb-6 space-y-3">
              <button
                onClick={() => handleSocialLogin('google')}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border py-3 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Fortsett med Google
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-4 text-muted-foreground">eller med e-post</span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleEmailAuth}>
              {isRegister && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-foreground">
                      Fornavn
                    </label>
                    <input
                      id="first-name"
                      name="first-name"
                      type="text"
                      required
                      minLength={2}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-foreground">
                      Etternavn
                    </label>
                    <input
                      id="last-name"
                      name="last-name"
                      type="text"
                      required
                      minLength={2}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  E-post
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  Passord
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-xl bg-brand py-3 px-4 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
              >
                {isLoading ? 'Vennligst vent…' : (
                  <span className="flex items-center">
                    {isRegister ? 'Registrer deg' : 'Logg inn'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                )}
              </button>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(!isRegister);
                    setError('');
                  }}
                  className="text-sm text-brand hover:underline"
                >
                  {isRegister ? 'Har du allerede konto? Logg inn her' : 'Trenger du konto? Registrer deg'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
