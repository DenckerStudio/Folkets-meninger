'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  SAK_MENING_PREFIX,
  SAK_MENING_STATEMENT_MAX,
  SAK_MENING_STATEMENT_MIN,
  validateSakMeningStatement,
} from '@/lib/forum/sak-mening';
import { routes } from '@/lib/routes';

type SakMeningFormProps = {
  sakId: string;
  sakTitle: string;
};

export function SakMeningForm({ sakId, sakTitle }: SakMeningFormProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [statement, setStatement] = useState('');
  const [hasIdentity, setHasIdentity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => setHasIdentity(!!data.has_forum_identity))
      .catch(() => {});
  }, [user]);

  const preview = validateSakMeningStatement(statement);
  const previewQuestion = preview.ok ? preview.question : `${SAK_MENING_PREFIX}${statement.trim()}`;

  const handleSubmit = async () => {
    const validated = validateSakMeningStatement(statement);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/forum/sak-mening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stortinget_issue_id: sakId,
        statement,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Kunne ikke publisere mening');
      return;
    }

    setMessage(data.message || 'Ja/nei-meningen er publisert.');
    setStatement('');
    router.push(routes.sak(sakId));
    router.refresh();
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
        <Link href={routes.login} className="font-medium text-indigo-600 hover:text-indigo-500">
          Logg inn for å dele en ja/nei-mening
        </Link>
      </div>
    );
  }

  if (!hasIdentity) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-6 py-8 text-sm text-amber-900">
        Du må fylle ut fornavn og etternavn før du kan dele en mening i forumet.{' '}
        <Link
          href={`${routes.completeProfile}?next=${encodeURIComponent(routes.forumMening(sakId))}`}
          className="font-semibold text-indigo-700 hover:text-indigo-600"
        >
          Fullfør profilen
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Sak</p>
        <p className="mt-1 font-semibold text-indigo-950">{sakTitle}</p>
      </div>

      <form
        className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <label htmlFor="sak-mening-statement" className="block text-sm font-medium text-gray-800">
            Din mening
          </label>
          <div className="mt-2 flex rounded-xl border border-gray-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
            <span className="inline-flex items-center rounded-l-xl bg-gray-50 px-3 py-3 text-sm font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
              {SAK_MENING_PREFIX.trim()}
            </span>
            <textarea
              id="sak-mening-statement"
              rows={4}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              maxLength={SAK_MENING_STATEMENT_MAX}
              className="min-h-[120px] w-full rounded-r-xl border-0 px-3 py-3 text-sm text-gray-900 focus:outline-none focus:ring-0"
              placeholder="Norge bør si ja til dette forslaget fordi …"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {statement.trim().length}/{SAK_MENING_STATEMENT_MAX} tegn (min. {SAK_MENING_STATEMENT_MIN})
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-gray-100">
          <p className="font-medium text-gray-900">Forhåndsvisning</p>
          <p className="mt-1 leading-relaxed">{previewQuestion || `${SAK_MENING_PREFIX}…`}</p>
          <p className="mt-2 text-xs text-gray-500">Andre kan svare Ja eller Nei på denne meningsspørsmålet.</p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <button
          type="submit"
          disabled={submitting || statement.trim().length < SAK_MENING_STATEMENT_MIN}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
          Publiser ja/nei-mening
        </button>
      </form>
    </div>
  );
}
