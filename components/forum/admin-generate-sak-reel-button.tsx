'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

type AdminGenerateSakReelButtonProps = {
  issueId: string;
  issueTitle: string;
};

export function AdminGenerateSakReelButton({
  issueId,
  issueTitle,
}: AdminGenerateSakReelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/forum-sak-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stortinget_issue_id: issueId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error ?? 'Kunne ikke starte generering'));
        return;
      }
      setMessage(
        'Reel-utkast genereres (RAG). Sjekk admin → Forum prompts → Pipeline om noen minutter.',
      );
    } catch {
      setError('Nettverksfeil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50 dark:bg-indigo-950/40/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Forum admin
          </p>
          <p className="text-sm text-foreground mt-1">
            Generer JA/NEI-reel fra denne saken med RAG (dokumentchunks + sammendrag).
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate max-w-xl" title={issueTitle}>
            {issueTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-50 dark:bg-indigo-950/400 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generer reel-utkast
        </button>
      </div>
      {message ? <p className="text-sm text-green-700 mt-3">{message}</p> : null}
      {error ? <p className="text-sm text-destructive mt-3">{error}</p> : null}
    </div>
  );
}
