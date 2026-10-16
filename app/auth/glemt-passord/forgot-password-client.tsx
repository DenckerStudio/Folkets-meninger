'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { getBrowserSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const supabase = getBrowserSupabase();
      const redirectTo = `${window.location.origin}${routes.tilbakestillPassord}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } catch {
      setError('Kunne ikke sende e-post. Prøv igjen.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">
      <FadeIn delay={0.1}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
              <Mail className="h-8 w-8 text-brand" />
            </div>
          </div>
          <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Glemt passord?
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Vi sender deg en lenke for å sette et nytt passord.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:rounded-3xl sm:px-10 sm:py-8">
            {error ? (
              <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {sent ? (
              <div className="space-y-4 text-center text-sm text-muted-foreground">
                <p>
                  Hvis det finnes en konto for <strong className="text-foreground">{email}</strong>, har vi sendt en
                  e-post med lenke for å sette nytt passord.
                </p>
                <p>Sjekk innboksen og søppelpost. Lenken utløper etter en stund.</p>
                <Link
                  href={routes.login}
                  className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-brand hover:text-brand/80"
                >
                  Tilbake til innlogging
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-foreground">
                    E-post
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-border px-3 py-3 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  {isLoading ? 'Sender …' : 'Send tilbakestillingslenke'}
                </button>
              </form>
            )}
            <p className="mt-6 text-center">
              <Link
                href={routes.login}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Tilbake til innlogging
              </Link>
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
