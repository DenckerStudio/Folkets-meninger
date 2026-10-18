'use client';

import { useState } from 'react';
import {
  AI_FEEDBACK_REASON_CODES,
  AI_REASON_NOTE_MAX,
  type AiFeedbackReasonCode,
} from '@/lib/ai/reason-codes';

type AdminPollDraftReviewProps = {
  pollId: string;
  initialTitle: string;
  initialSummary: string;
  disabled?: boolean;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export function AdminPollDraftReview({
  pollId,
  initialTitle,
  initialSummary,
  disabled,
  onSuccess,
  onError,
}: AdminPollDraftReviewProps) {
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [reasonCode, setReasonCode] = useState<AiFeedbackReasonCode | ''>('');
  const [reasonNote, setReasonNote] = useState('');
  const [pending, setPending] = useState(false);

  const patch = async (action: 'publish' | 'archive') => {
    if (action === 'archive' && !reasonCode) {
      onError('Velg en grunnkode før du arkiverer.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/admin/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pollId,
          action,
          title: title.trim(),
          neutralSummary: summary.trim(),
          reasonCode: action === 'archive' ? reasonCode : undefined,
          reasonNote: reasonNote.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(typeof json.error === 'string' ? json.error : 'Kunne ikke oppdatere utkastet');
        return;
      }
      onSuccess(action === 'publish' ? 'Utkast publisert.' : 'Utkast arkivert.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">Rediger før publisering</p>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Tittel</span>
        <input
          type="text"
          maxLength={140}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Nøytralt sammendrag</span>
        <textarea
          maxLength={600}
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Grunnkode (påkrevd ved arkivering)</span>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as AiFeedbackReasonCode | '')}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="">Velg grunn …</option>
            {AI_FEEDBACK_REASON_CODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">
            Valgfritt notat (maks {AI_REASON_NOTE_MAX} tegn — ikke skriv navn)
          </span>
          <textarea
            maxLength={AI_REASON_NOTE_MAX}
            rows={2}
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => patch('publish')}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          Rediger og publiser
        </button>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => patch('archive')}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Arkiver med grunn
        </button>
      </div>
    </div>
  );
}
