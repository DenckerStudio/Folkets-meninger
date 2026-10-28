'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { DraftExpiryBadge } from '@/components/admin/draft-expiry-badge';
import { UtenKontekstBadge } from '@/components/admin/uten-kontekst-badge';
import {
  getUtenKontekstPrefixNoticeMessage,
  isPollDraftUtenKontekst,
} from '@/lib/admin/uten-kontekst';
import {
  DraftReviewQueueToggle,
  type DraftReviewQueue,
} from '@/components/admin/draft-review-queue-toggle';
import { ReelContentPreview } from '@/components/admin/reel-content-preview';
import { EmptyState } from '@/components/dashboard/empty-state';
import type { ContentFeedbackVerdict } from '@/lib/content-feedback/types';
import { routes } from '@/lib/routes';
import { DRAFT_RESTORE_SUCCESS_MESSAGE } from '@/lib/admin/draft-expiry';
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
  const [queue, setQueue] = useState<DraftReviewQueue>('pending');
  const [drafts, setDrafts] = useState<PollRecord[]>([]);
  const [reviewed, setReviewed] = useState<ReviewedReel | null>(null);
  const [error, setError] = useState('');
  const [publishErrors, setPublishErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      setError('');
      try {
        const res = await fetch(
          `/api/admin/polls?queue=${queue === 'expired' ? 'expired' : 'pending'}`,
        );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when queue changes
  }, [queue]);

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

  const patchPoll = (poll: PollRecord, action: 'publish' | 'archive' | 'restore') => {
    startTransition(async () => {
      setError('');
      setPublishErrors((current) => {
        const next = { ...current };
        delete next[poll.id];
        return next;
      });
      setSuccess('');
      const res = await fetch('/api/admin/polls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: poll.id, action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const raw = typeof data.error === 'string' ? data.error : 'Handling feilet';
        const message = raw.endsWith('.') ? raw : `${raw}.`;
        if (action === 'publish') {
          setPublishErrors((current) => ({ ...current, [poll.id]: message }));
        } else {
          setError(message);
        }
        return;
      }
      if (action === 'restore') {
        setSuccess(DRAFT_RESTORE_SUCCESS_MESSAGE);
        setReviewed(null);
        setDrafts((current) => current.filter((row) => row.id !== poll.id));
        return;
      } else {
        setSuccess(action === 'publish' ? 'Utkastet er publisert.' : 'Utkastet er arkivert.');
        setReviewed({
          poll,
          verdict: action === 'publish' ? 'approve' : 'reject',
        });
      }
      setDrafts((current) => current.filter((row) => row.id !== poll.id));
      load();
    });
  };

  const visibleDrafts = drafts.filter((poll) => poll.id !== reviewed?.poll.id);

  return (
    <div className="space-y-4">
      <DraftReviewQueueToggle queue={queue} onQueueChange={setQueue} className="max-w-md" />
      <p className="text-sm text-muted-foreground">
        {queue === 'pending'
          ? 'Publiser til Reels-feeden, eller arkiver. Utkast utløper etter 72 timer uten vurdering.'
          : 'Utløpte utkast kan gjenopprettes til vurderingskøen.'}
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
          title={queue === 'expired' ? 'Ingen utløpte utkast' : 'Ingen utkast'}
          description={
            queue === 'expired'
              ? 'Utløpte reel-utkast vises her.'
              : 'Generer fra Reels-siden, eller vent på automatisk kjøring.'
          }
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
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                <div className="min-w-0 flex-1">
                  <ReelContentPreview poll={poll} />
                </div>
                {queue === 'pending' ? (
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    {isPollDraftUtenKontekst(poll.generationMetadata) ? (
                      <UtenKontekstBadge />
                    ) : null}
                    <DraftExpiryBadge
                      clock={{ createdAt: poll.createdAt, restoredAt: poll.restoredAt }}
                    />
                  </div>
                ) : null}
              </div>
              {queue === 'expired' && poll.expiredAt ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Utløpt {new Date(poll.expiredAt).toLocaleString('nb-NO')}
                </p>
              ) : null}
              <div className="mt-4 space-y-2">
                {queue === 'pending' ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
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
                    {(() => {
                      const notice = getUtenKontekstPrefixNoticeMessage(poll);
                      return notice ? (
                        <p
                          className="w-full text-sm leading-snug text-amber-900 dark:text-amber-200"
                          role="note"
                        >
                          {notice}
                        </p>
                      ) : null;
                    })()}
                    {publishErrors[poll.id] ? (
                      <p className="w-full text-sm leading-snug text-destructive" role="alert">
                        {publishErrors[poll.id]}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => patchPoll(poll, 'restore')}
                    className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Gjenopprett
                  </button>
                  </div>
                )}
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
