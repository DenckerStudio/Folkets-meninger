'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, Sparkles } from 'lucide-react';
import { PointsProgress } from '@/components/profile/points-progress';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import { getUserPointsProgress } from '@/lib/user-points-levels';
import type { ReelSubmissionAccess } from '@/lib/forum/reel-submission-access';
import { routes } from '@/lib/routes';

type SourceRow = {
  title: string;
  url: string;
  outlet: string;
};

function emptySourceRow(): SourceRow {
  return { title: '', url: '', outlet: 'Nyhet' };
}

export function ForeslaReelClient() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [question, setQuestion] = useState('');
  const [sources, setSources] = useState<SourceRow[]>([emptySourceRow()]);
  const [topicTags, setTopicTags] = useState('');
  const [sensitivity, setSensitivity] = useState<'low' | 'high'>('low');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [access, setAccess] = useState<ReelSubmissionAccess | null>(null);
  const [points, setPoints] = useState(0);
  const [pointsProgress, setPointsProgress] = useState<UserPointsProgress>(() => getUserPointsProgress(0));

  useEffect(() => {
    fetch('/api/forum/reel-submit', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.access) setAccess(data.access);
        if (typeof data.points === 'number') setPoints(data.points);
        if (data.points_progress) setPointsProgress(data.points_progress);
      })
      .catch(() => setError('Kunne ikke laste tilgang til reel-innsending.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    setMessage('');

    const res = await fetch('/api/forum/reel-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        source_headlines: sources,
        topic_tags: topicTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        sensitivity,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || 'Kunne ikke sende inn forslag');
      return;
    }

    if (typeof data.points === 'number') setPoints(data.points);
    if (data.points_progress) setPointsProgress(data.points_progress);
    if (data.access) setAccess(data.access);

    setMessage(data.message || 'Forslag sendt.');
    setQuestion('');
    setSources([emptySourceRow()]);
    setTopicTags('');
    setSensitivity('low');

    fetch('/api/forum/reel-submit', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.access) setAccess(payload.access);
      })
      .catch(() => {});
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-500">Laster…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={routes.forumSpesielleSaker}
        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Tilbake til spesielle saker
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">Foreslå forum-reel</h1>
        </div>
        <p className="text-sm leading-6 text-gray-600">
          Med nok poeng kan du foreslå spørsmål fra nyhetsbildet. Pålitelige brukere sender til admin-godkjenning.
          Kuratorer kan publisere direkte fra godkjente kilder.
        </p>
      </header>

      <PointsProgress points={points} progress={pointsProgress} compact />

      {access?.mode === 'locked' ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm leading-6 text-gray-700">
          Du trenger <strong>{access.pointsNeeded} poeng til</strong> (totalt 750) for å foreslå reels. Poeng tjenes
          gjennom forum, stemming og verified profil.
        </div>
      ) : (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 text-sm text-indigo-950">
          {access?.mode === 'curator' ? (
            <p>
              Du er <strong>Kurator</strong>. Reels fra godkjente kilder publiseres direkte. Ukjente domener går fortsatt
              til admin.
            </p>
          ) : (
            <p>
              Du er <strong>Pålitelig</strong>. Forslag sendes som utkast og godkjennes av admin før publisering.
            </p>
          )}
          <p className="mt-2">
            Ukentlig kvote: {access?.weeklyRemaining ?? 0} av {access?.weeklyLimit ?? 0} igjen.
          </p>
        </div>
      )}

      {access && access.mode !== 'locked' ? (
        <form
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div>
            <label htmlFor="reel-question" className="block text-sm font-medium text-gray-700">
              Spørsmål
            </label>
            <textarea
              id="reel-question"
              rows={3}
              maxLength={280}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="F.eks.: Bør Norge øke støtten til Ukraina ytterligere i 2026?"
            />
            <p className="mt-1 text-xs text-gray-500">{question.length}/280 tegn</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Kilder</p>
            {sources.map((row, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-3">
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Tittel"
                  value={row.title}
                  onChange={(e) => {
                    const next = [...sources];
                    next[index] = { ...next[index], title: e.target.value };
                    setSources(next);
                  }}
                />
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="https://…"
                  value={row.url}
                  onChange={(e) => {
                    const next = [...sources];
                    next[index] = { ...next[index], url: e.target.value };
                    setSources(next);
                  }}
                />
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Avis"
                  value={row.outlet}
                  onChange={(e) => {
                    const next = [...sources];
                    next[index] = { ...next[index], outlet: e.target.value };
                    setSources(next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSources((prev) => [...prev, emptySourceRow()])}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              + Legg til kilde
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reel-tags" className="block text-sm font-medium text-gray-700">
                Stikkord (valgfritt)
              </label>
              <input
                id="reel-tags"
                value={topicTags}
                onChange={(e) => setTopicTags(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                placeholder="f.eks. utenrikspolitikk, økonomi"
              />
            </div>
            <div>
              <label htmlFor="reel-sensitivity" className="block text-sm font-medium text-gray-700">
                Sensitivitet
              </label>
              <select
                id="reel-sensitivity"
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value === 'high' ? 'high' : 'low')}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="low">Lav</option>
                <option value="high">Høy</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          <button
            type="submit"
            disabled={submitting || !access.canSubmit || question.trim().length < 12}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {access.mode === 'curator' ? 'Send inn reel' : 'Send til godkjenning'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
