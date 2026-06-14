'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import FadeIn from '@/components/fade-in';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { sanitizePostLoginPath } from '@/lib/safe-redirect';

export default function CompleteProfileClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizePostLoginPath(searchParams.get('next'));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`${routes.login}?next=${encodeURIComponent('/auth/complete-profile')}`);
      return;
    }

    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.has_forum_identity) {
          router.replace(nextPath);
          return;
        }
        if (data.first_name) setFirstName(data.first_name);
        if (data.last_name) setLastName(data.last_name);
      })
      .catch(() => {});
  }, [user, loading, router, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName, last_name: lastName }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Kunne ikke lagre');
      return;
    }

    router.replace(nextPath);
    router.refresh();
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <FadeIn delay={0.1}>
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Fullfør profilen din</h1>
          <p className="mt-2 text-sm text-gray-600">
            Foruminnlegg er offentlige og viser fornavn og etternavn. Stemmer forblir anonyme i statistikken.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <form
            onSubmit={handleSubmit}
            className="bg-white py-8 px-6 shadow-sm rounded-3xl border border-gray-100 space-y-4"
          >
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
                Fornavn
              </label>
              <input
                id="first-name"
                required
                minLength={2}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
                Etternavn
              </label>
              <input
                id="last-name"
                required
                minLength={2}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Lagrer…' : 'Fortsett'}
            </button>

            <p className="text-xs text-center text-gray-500">
              Du kan endre navnet senere under{' '}
              <Link href={routes.minSide} className="text-indigo-600 hover:underline">
                Min side
              </Link>
              .
            </p>
          </form>
        </div>
      </FadeIn>
    </div>
  );
}
