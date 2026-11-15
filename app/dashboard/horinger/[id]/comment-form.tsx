'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useStemmePlusActive } from '@/hooks/use-stemme-plus-active';
import { routes } from '@/lib/routes';
import { loginWithNext } from '@/lib/safe-redirect';

export default function HearingCommentForm({
  stortingetHearingId,
  initialFollowing = false,
}: {
  stortingetHearingId: string;
  initialFollowing?: boolean;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [following, setFollowing] = useState(initialFollowing);
  const [followBusy, setFollowBusy] = useState(false);
  const { user } = useAuth();
  const stemmePlus = useStemmePlusActive();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/hearings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stortinget_hearing_id: stortingetHearingId,
          body: body.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Kunne ikke publisere innspillet. Prøv igjen.');
        return;
      }

      setBody('');
      setSources([]);
      router.refresh();
    } catch {
      setError('Kunne ikke publisere innspillet. Prøv igjen.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateDraft = async () => {
    if (draftLoading) return;
    setDraftLoading(true);
    setDraftError('');
    try {
      const res = await fetch(`/api/horinger/${encodeURIComponent(stortingetHearingId)}/utkast`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        draft?: string;
        sources?: string[];
      };
      if (!res.ok) {
        setDraftError(data.error || 'Kunne ikke lage utkast');
        setSources(Array.isArray(data.sources) ? data.sources : []);
        return;
      }
      if (typeof data.draft === 'string' && data.draft.trim()) {
        setBody(data.draft.trim());
      }
      setSources(Array.isArray(data.sources) ? data.sources.filter(Boolean) : []);
    } catch {
      setDraftError('Kunne ikke lage utkast. Prøv igjen.');
    } finally {
      setDraftLoading(false);
    }
  };

  const toggleFollow = async () => {
    if (!user || followBusy) return;
    setFollowBusy(true);
    try {
      const next = !following;
      const res = await fetch(`/api/horinger/${encodeURIComponent(stortingetHearingId)}/interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; following?: boolean };
      if (!res.ok) {
        setError(data.error || 'Kunne ikke oppdatere følging');
        return;
      }
      setFollowing(Boolean(data.following));
    } catch {
      setError('Kunne ikke oppdatere følging');
    } finally {
      setFollowBusy(false);
    }
  };

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        <Link
          href={loginWithNext(routes.horing(stortingetHearingId))}
          className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
        >
          Logg inn
        </Link>{' '}
        for å gi innspill.
      </p>
    );
  }

  const canDraft = stemmePlus === 'active';

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void toggleFollow()}
          disabled={followBusy}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {following ? 'Slutt å følge frist' : 'Følg frist'}
        </button>
        <button
          type="button"
          onClick={() => void generateDraft()}
          disabled={!canDraft || draftLoading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {draftLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Lag utkast
        </button>
        {stemmePlus === 'inactive' ? (
          <Link
            href={`${routes.minSide}?tab=stemme-plus`}
            className="text-xs text-muted-foreground hover:text-brand"
          >
            Utkast krever Stemme+ og egen modellnøkkel
          </Link>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Les gjennom og tilpass før du sender. Innspillet publiseres med ditt navn og er offentlig
        synlig.
      </p>
      {draftError ? <p className="text-sm text-destructive">{draftError}</p> : null}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="w-full rounded-lg border border-border bg-background p-3 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        placeholder="Skriv innspillet ditt…"
        required
      />
      {sources.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Kilder i høringsdokumenter</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {sources.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 sm:w-auto"
      >
        {submitting ? 'Publiserer…' : 'Publiser innspill'}
      </button>
    </form>
  );
}