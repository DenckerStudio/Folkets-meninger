'use client';

import { useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { CONTENT_REPORT_CATEGORIES, type ContentReportCategory, contentReportCategoryLabel } from '@/lib/moderation/content-report';

/**
 * Replaces the retired sak-page discussion reporter. Opinions and their replies
 * are reported through /api/opinions/report into the shared content_reports
 * table, using the same moderation categories as before.
 */
export function OpinionReportButton({
  targetType,
  targetId,
}: {
  targetType: 'citizen_opinion' | 'citizen_opinion_reply';
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ContentReportCategory>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-xs text-muted-foreground">Takk — rapporten er sendt.</p>;
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/opinions/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, category, details: details || null }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke sende rapporten');
        return;
      }
      setDone(true);
    } catch {
      setError('En feil oppstod');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-3.5 w-3.5" />
        Rapporter
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium text-foreground">Rapporter dette innholdet</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as ContentReportCategory)}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="Rapportkategori"
        >
          {CONTENT_REPORT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {contentReportCategoryLabel(value)}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Kort forklaring (valgfritt)"
          maxLength={500}
          className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Send rapport
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Avbryt
        </button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </div>
    </div>
  );
}
