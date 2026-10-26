'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { ReelContentPreview } from '@/components/admin/reel-content-preview';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { ContentFeedbackVerdict } from '@/lib/content-feedback/types';
import { routes } from '@/lib/routes';
import type { PollRecord } from '@/lib/polls/types';

type DraftsResponse = { drafts?: PollRecord[] };
type ReviewedReel = {
  poll: PollRecord;
  verdict: ContentFeedbackVerdict;
};

function DraftListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Laster reel-utkast">
      {[0, 1].map((key) => (
        <div key={key} className="h-36 animate-pulse rounded-2xl border border-border bg-muted/30" />
      ))}
    </div>
  );
}

export function ReelDraftReview() {
  const searchParams = useSearchParams();
  const highlightPollId = searchParams.get('pollId')?.trim() ?? '';
  const highlightedRef = useRef(false);
  const reviewedRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<PollRecord[]>([]);
  const [reviewed, setReviewed] = useState<ReviewedReel | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch('/api/admin/polls');
        const json = (await res.json().catch(() => ({}))) as DraftsResponse & { error?: string };
        if (!res.ok) {
          setError(typeof json.error === 'string' ? json.error : 'Kunne ikke laste utkast');
          return;
        }
        setDrafts(json.drafts ?? []);
      } catch {
        setError('Kunne ikke laste utkast');
      } finally {
        setInitialLoad(false);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!reviewed) return;
    reviewedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [reviewed]);

  useEffect(() => {
    if (!highlightPollId || highlightedRef.current || drafts.length === 0) return;
    const el = document.getElementById(`reel-draft-${highlightPollId}`);
    if (!el) return;
    highlightedRef.current = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-brand');
  }, [drafts, highlightPollId]);

  const patchPoll = (poll: PollRecord, action: 'publish' | 'archive') => {
    startTransition(async () => {
      setError('');
      setSuccess('');
      const res = await fetch('/api/admin/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poll.id, action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(typeof data.error === 'string' ? data.error : 'Handling feilet');
        return;
      }
      setSuccess(action === 'publish' ? 'Utkastet er publisert.' : 'Utkastet er arkivert.');
      setReviewed({
        poll,
        verdict: action === 'publish' ? 'approve' : 'reject',
      });
      setDrafts((current) => current.filter((row) => row.id !== poll.id));
      load();
    });
  };

  const visibleDrafts = drafts.filter((poll) => poll.id !== reviewed?.poll.id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Publiser til Reels-feeden, eller arkiver. Tittel, beskrivelse og kilder blir stående mens du gir
        tilbakemelding.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      {reviewed ? (
        <div ref={reviewedRef}>
          <ContentFeedbackPanel
            key={`${reviewed.poll.id}-${reviewed.verdict}`}
            contentType="reel"
            contentId={reviewed.poll.id}
            lockedVerdict={reviewed.verdict}
            preview={<ReelContentPreview poll={reviewed.poll} />}
            title={reviewed.verdict === 'reject' ? 'Hva kunne vært bedre?' : 'Hva fungerte bra?'}
            description={
              reviewed.verdict === 'reject'
                ? 'Valgfritt — hjelper oss å unngå lignende utkast.'
                : 'Valgfritt — hjelper oss med neste generering.'
            }
            onSkip={() => setReviewed(null)}
            onSaved={() => setReviewed(null)}
          />
        </div>
      ) : null}
      {initialLoad ? <DraftListSkeleton /> : null}
      {!initialLoad && visibleDrafts.length === 0 && !reviewed ? (
        <EmptyState
          title="Ingen utkast"
          description="Generer fra Reels-siden, eller vent på automatisk kjøring."
          className="py-8"
        />
      ) : null}
      {visibleDrafts.length > 0 ? (
        <ul className="space-y-3">
          {visibleDrafts.map((poll) => (
            <li
              key={poll.id}
              id={`reel-draft-${poll.id}`}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <ReelContentPreview poll={poll} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patchPoll(poll, 'publish')}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                >
                  Publiser
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => patchPoll(poll, 'archive')}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  Arkiver
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={routes.adminReels} className="font-medium text-brand hover:underline">
          Generering og kø
        </Link>
        <Link href={routes.utforsk} className="font-medium text-brand hover:underline">
          Offentlig Reels-feed
        </Link>
      </div>
    </div>
  );
}
