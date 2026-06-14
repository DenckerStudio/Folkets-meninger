'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { FORUM_LIMITS } from '@/lib/forum/validation';
import { routes } from '@/lib/routes';

export default function ForumReplyForm({ threadId }: { threadId: string }) {
  const [body, setBody] = useState('');
  const [isOfficialResponse, setIsOfficialResponse] = useState(false);
  const [isPolitician, setIsPolitician] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      setIsPolitician(false);
      setDisplayName(null);
      return;
    }

    fetch('/api/user/politician-status')
      .then((res) => res.json())
      .then((data) => setIsPolitician(!!data.isVerified))
      .catch(() => setIsPolitician(false));

    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setHasIdentity(!!data.has_forum_identity);
        setDisplayName(data.display_name || null);
      })
      .catch(() => {});
  }, [user]);

  const handleSubmit = async () => {
    if (!body.trim() || isSubmitting) return;
    if (!hasIdentity) {
      router.push(`${routes.completeProfile}?next=${encodeURIComponent(`/dashboard/forum/${threadId}`)}`);
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const payload: Record<string, unknown> = {
        action: 'create_reply',
        thread_id: threadId,
        body: body.trim(),
      };

      if (isPolitician && isOfficialResponse) {
        payload.is_official_response = true;
      }

      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Kunne ikke publisere svar');
        return;
      }

      setBody('');
      setIsOfficialResponse(false);
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Skriv et svar</h3>
      {!user ? (
        <div className="text-center py-4">
          <Link href={routes.login} className="inline-flex items-center text-indigo-600 hover:text-indigo-500 font-medium">
            <LogIn className="w-4 h-4 mr-1.5" />
            Logg inn for å svare
          </Link>
        </div>
      ) : (
        <>
          {!hasIdentity ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
              Du må{' '}
              <Link href={routes.completeProfile} className="font-semibold underline">
                fullføre profilen
              </Link>{' '}
              med fornavn og etternavn før du kan svare. Innlegg vises med ditt navn og er ikke anonyme.
            </p>
          ) : displayName ? (
            <p className="text-xs text-gray-600 mb-3">
              Du svarer som <strong>{displayName}</strong>. Svaret er offentlig og kan ikke publiseres anonymt.
            </p>
          ) : null}
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 py-2 px-3 rounded-lg">
              {error}
            </div>
          )}
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={FORUM_LIMITS.bodyMax}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            placeholder="Hva tenker du om dette?"
          />
          {isPolitician && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isOfficialResponse}
                onChange={(e) => setIsOfficialResponse(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Marker som offisielt politikersvar
            </label>
          )}
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!body.trim() || isSubmitting}
              className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm text-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Publiserer...' : 'Publiser svar'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
