'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { getBrowserSupabase } from '@/lib/supabase';
import { routes } from '@/lib/routes';

export function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const code = searchParams.get('code');

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true);
        setChecking(false);
      }
    });

    const finishCheck = async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          setSessionReady(true);
        }
        setChecking(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
      }
      setChecking(false);
    };

    void finishCheck();

    return () => subscription.subscription.unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Passordet må være minst 8 tegn.');
      return;
    }
    if (password !== confirm) {
      setError('Passordene er ikke like.');
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getBrowserSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push(routes.utforsk);
      router.refresh();
    } catch {
      setError('Kunne ikke oppdatere passordet. Prøv igjen.');
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
              <KeyRound className="h-8 w-8 text-brand" />
            </div>
          </div>
          <h1 className="mt-6 text-center text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Sett nytt passord
          </h1>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:rounded-3xl sm:px-10 sm:py-8">
            {checking ? (
              <p className="text-center text-sm text-muted-foreground">Bekrefter lenken …</p>
            ) : !sessionReady ? (
              <div className="space-y-4 text-center text-sm text-muted-foreground">
                <p>Lenken er ugyldig eller utløpt. Be om en ny tilbakestillingslenke.</p>
                <Link
                  href={routes.glemtPassord}
                  className="inline-flex min-h-11 items-center font-medium text-brand hover:text-brand/80"
                >
                  Glemt passord
                </Link>
              </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
                    Nytt passord
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-border px-3 py-3 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
                    Bekreft passord
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-border px-3 py-3 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30 sm:text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-medium text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  {isLoading ? 'Lagrer …' : 'Lagre nytt passord'}
                </button>
              </form>
            )}
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
