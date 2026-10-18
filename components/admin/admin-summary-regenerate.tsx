'use client';

import { useState } from 'react';
import {
  AI_FEEDBACK_REASON_CODES,
  AI_REASON_NOTE_MAX,
  type AiFeedbackReasonCode,
} from '@/lib/ai/reason-codes';

type AdminSummaryRegenerateProps = {
  sakId: string;
};

export function AdminSummaryRegenerate({ sakId }: AdminSummaryRegenerateProps) {
  const [reasonCode, setReasonCode] = useState<AiFeedbackReasonCode | ''>('');
  const [reasonNote, setReasonNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const regenerate = async () => {
    if (!reasonCode) {
      setError('Velg en grunnkode før regenerering.');
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/sak/${sakId}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, reasonCode, reasonNote: reasonNote.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Kunne ikke regenerere');
        return;
      }
      setMessage('Nytt sammendrag er bestilt. Siden oppdateres om litt.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">Admin: regenerer sammendrag</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Det gamle sammendraget logges før sletting. Grunnkode er påkrevd.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value as AiFeedbackReasonCode | '')}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground sm:col-span-2"
        >
          <option value="">Velg grunn …</option>
          {AI_FEEDBACK_REASON_CODES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <textarea
          maxLength={AI_REASON_NOTE_MAX}
          rows={2}
          value={reasonNote}
          onChange={(e) => setReasonNote(e.target.value)}
          placeholder="Valgfritt notat (ikke skriv navn)"
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground sm:col-span-2"
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={regenerate}
        className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
      >
        Regenerer med grunn
      </button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
