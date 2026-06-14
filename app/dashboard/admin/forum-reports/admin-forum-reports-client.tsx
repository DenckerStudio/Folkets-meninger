'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, ExternalLink } from 'lucide-react';
import { reportCategoryLabel, type ForumReportListItem } from '@/lib/forum/reports';
import { routes } from '@/lib/routes';

export default function AdminForumReportsClient() {
  const [reports, setReports] = useState<ForumReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/forum-reports', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Kunne ikke hente rapporter');
        return;
      }
      setReports(json.reports ?? []);
    } catch {
      setError('Nettverksfeil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: string, status: 'reviewed' | 'dismissed') => {
    setActingId(id);
    try {
      const res = await fetch('/api/admin/forum-reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? 'Kunne ikke oppdatere');
        return;
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flag className="w-6 h-6 text-rose-600" />
            Forum-rapporter
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Åpne rapporter fra brukere. Forumtekst er offentlig — vurder innhold og eventuell oppfølging.
          </p>
        </div>
        <Link
          href={routes.adminForumPrompts}
          className="text-sm text-indigo-600 hover:underline shrink-0"
        >
          Prompt-admin →
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Laster…</p>
      ) : reports.length === 0 ? (
        <p className="text-gray-500 text-sm rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
          Ingen åpne rapporter.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
                <span className="font-medium text-rose-700">
                  {reportCategoryLabel(r.category)}
                </span>
                <span>·</span>
                <span>{r.targetType === 'thread' ? 'Tråd' : 'Svar'}</span>
                <span>·</span>
                <span>{new Date(r.createdAt).toLocaleString('nb-NO')}</span>
              </div>
              <h2 className="font-semibold text-gray-900">{r.targetTitle}</h2>
              {r.targetAuthorName && (
                <p className="text-xs text-gray-500 mt-0.5">Av {r.targetAuthorName}</p>
              )}
              <p className="text-sm text-gray-600 mt-2">{r.targetExcerpt}</p>
              {r.reason && (
                <p className="text-sm text-gray-700 mt-2 italic border-l-2 border-rose-200 pl-3">
                  «{r.reason}»
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={
                    r.targetType === 'reply'
                      ? `${routes.forumTopic(r.threadId)}#reply-${r.targetId}`
                      : routes.forumTopic(r.threadId)
                  }
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Vis innlegg
                </Link>
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => resolve(r.id, 'reviewed')}
                  className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Markert behandlet
                </button>
                <button
                  type="button"
                  disabled={actingId === r.id}
                  onClick={() => resolve(r.id, 'dismissed')}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Avvis
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
