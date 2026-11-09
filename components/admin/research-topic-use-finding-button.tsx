'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { ResearchBriefStatusBadge } from '@/components/admin/research-brief-status-badge';
import { buttonVariants } from '@/components/ui/button';
import { RESEARCH_BRIEF_POLL_MS } from '@/lib/admin/research/polling';
import {
  RESEARCH_JOB_SLOW_NOTICE_DETAIL,
  RESEARCH_JOB_SLOW_NOTICE_HEADLINE,
} from '@/lib/admin/research/slow-job-notice';
import {
  researchTopicHasOpenableBrief,
  type ResearchTopicSourceKind,
  type ResearchTopicStatus,
} from '@/lib/admin/research/topic-brief-schema';
import { formatResearchTopicBriefError, researchTopicBriefErrorAllowsRetry } from '@/lib/admin/research/topic-error-messages';
import type { ResearchTopicSnapshot } from '@/lib/admin/research/topic-types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

function isBusy(status: ResearchTopicStatus | undefined, pending: boolean): boolean {
  return pending || status === 'queued' || status === 'running';
}

export function ResearchTopicUseFindingButton({
  sourceKind,
  clusterId,
  redditSignalId,
  title,
  initialSnapshot,
  className,
  compact,
}: {
  sourceKind: ResearchTopicSourceKind;
  clusterId?: string;
  redditSignalId?: string;
  title: string;
  initialSnapshot?: ResearchTopicSnapshot | null;
  className?: string;
  compact?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ResearchTopicSnapshot | null>(initialSnapshot ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSnapshot(initialSnapshot ?? null);
  }, [initialSnapshot]);

  const status = snapshot?.status;
  const openable = status ? researchTopicHasOpenableBrief(status) : false;
  const failed = status === 'failed';
  const failedRetryable = failed && researchTopicBriefErrorAllowsRetry(snapshot?.error);
  const failedTerminal = failed && !researchTopicBriefErrorAllowsRetry(snapshot?.error);
  const busy = isBusy(status, pending);

  const pollTopic = useCallback(async () => {
    if (!snapshot?.topicId) return;
    try {
      const res = await fetch(
        `/api/admin/research/topics?topic_id=${encodeURIComponent(snapshot.topicId)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        topic_id?: string;
        status?: ResearchTopicStatus;
        request_id?: string;
        publishable?: boolean | null;
        error?: string | null;
        updated_at?: string;
      };
      if (!body.topic_id || !body.status || !body.request_id) return;
      setSnapshot({
        topicId: body.topic_id,
        status: body.status,
        requestId: body.request_id,
        publishable: body.publishable ?? null,
        error: typeof body.error === 'string' ? body.error : null,
        updatedAt: body.updated_at ?? snapshot.updatedAt,
      });
    } catch {
      /* ignore poll errors */
    }
  }, [snapshot?.topicId, snapshot?.updatedAt]);

  useEffect(() => {
    if (status !== 'queued' && status !== 'running') return;
    void pollTopic();
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void pollTopic();
    }, RESEARCH_BRIEF_POLL_MS);
    return () => window.clearInterval(id);
  }, [pollTopic, status]);

  const startRequest = useCallback(
    async (force: boolean) => {
      setError('');
      setPending(true);
      const requestId = crypto.randomUUID();
      try {
        const res = await fetch('/api/admin/research/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_kind: sourceKind,
            cluster_id: sourceKind === 'cluster' ? clusterId : undefined,
            reddit_signal_id: sourceKind === 'reddit' ? redditSignalId : undefined,
            title: sourceKind === 'cluster' ? title : undefined,
            request_id: requestId,
            force,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          topic_id?: string;
          request_id?: string;
          status?: ResearchTopicStatus;
          publishable?: boolean | null;
          error?: string | null;
          message?: string;
        };
        if (res.status === 401 || res.status === 403) {
          setError('Ingen tilgang');
          return;
        }
        if (!res.ok) {
          setError(
            typeof body.message === 'string' && body.message.trim()
              ? body.message
              : 'Kunne ikke starte tema-brief',
          );
          return;
        }
        if (body.topic_id && body.request_id && body.status) {
          setSnapshot({
            topicId: body.topic_id,
            requestId: body.request_id,
            status: body.status,
            publishable: body.publishable ?? null,
            error: typeof body.error === 'string' ? body.error : null,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        setError('Kunne ikke starte tema-brief');
      } finally {
        setPending(false);
      }
    },
    [clusterId, redditSignalId, sourceKind, title],
  );

  const showSlowNotice = useMemo(() => {
    if (!snapshot?.updatedAt || (status !== 'queued' && status !== 'running')) return false;
    const ageMs = Date.now() - new Date(snapshot.updatedAt).getTime();
    return ageMs > 5 * 60_000;
  }, [snapshot?.updatedAt, status]);

  if (openable && snapshot) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        <Link
          href={routes.adminResearchTopic(snapshot.topicId)}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'min-h-11 w-full max-w-full justify-center whitespace-normal text-center text-xs font-medium leading-snug focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          Åpne brief
        </Link>
      </div>
    );
  }

  if (failedTerminal) {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        <ResearchBriefStatusBadge status="failed" />
        <p className="text-xs text-muted-foreground" role="status">
          {formatResearchTopicBriefError(snapshot?.error)}
        </p>
      </div>
    );
  }

  let label = 'Bruk funn';
  if (busy) label = 'Lager brief…';
  else if (failedRetryable) label = 'Prøv igjen';

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      {status && (status === 'queued' || status === 'running' || status === 'failed') ? (
        <ResearchBriefStatusBadge status={status} />
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void startRequest(failedRetryable)}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'min-h-11 w-full max-w-full justify-center gap-1.5 whitespace-normal text-center text-xs font-medium leading-snug focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
          failedRetryable && !busy && 'border-destructive/40 text-destructive hover:bg-destructive/10',
        )}
      >
        {busy ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : null}
        <span>{label}</span>
      </button>
      {!compact ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Jobben fortsetter på serveren om du forlater siden. Status oppdateres når du er tilbake.
        </p>
      ) : null}
      {showSlowNotice ? (
        <div className="space-y-0.5" role="status">
          <p className="text-xs text-foreground">{RESEARCH_JOB_SLOW_NOTICE_HEADLINE}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {RESEARCH_JOB_SLOW_NOTICE_DETAIL}
          </p>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
