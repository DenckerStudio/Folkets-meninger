'use client';

import { useCallback, useState } from 'react';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ResearchApiAction } from '@/lib/admin/research/actions';
import type { ClusterFeedbackValue } from '@/lib/admin/research/feedback-adapter';
import { routes } from '@/lib/routes';
import Link from 'next/link';

const ACTION_LABELS: Record<ResearchApiAction, string> = {
  deepen: 'Utdyp research',
  blog: 'Lag blogginnlegg',
  reel: 'Lag Reel',
};

const CONFIRM: Record<ResearchApiAction, string> = {
  deepen: 'Starte utdyping av denne klyngen?',
  blog: 'Opprette bloggutkast fra denne klyngen?',
  reel: 'Opprette Reel-utkast fra denne klyngen?',
};

export function ResearchRowActions({
  clusterId,
  userId,
}: {
  clusterId: string;
  userId?: string;
}) {
  const [feedback, setFeedback] = useState<ClusterFeedbackValue | null>(null);
  const [pendingAction, setPendingAction] = useState<ResearchApiAction | null>(null);
  const [queued, setQueued] = useState<Set<ResearchApiAction>>(() => new Set());
  const [error, setError] = useState('');

  const runAction = useCallback(async (action: ResearchApiAction) => {
    if (!window.confirm(CONFIRM[action])) return;
    setError('');
    setPendingAction(action);
    try {
      const res = await fetch(`/api/admin/research/${clusterId}/${action}`, { method: 'POST' });
      if (res.status === 401 || res.status === 403) {
        setError('Ingen tilgang');
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Kunne ikke starte oppgaven');
        return;
      }
      setQueued((prev) => new Set(prev).add(action));
    } catch {
      setError('Kunne ikke starte oppgaven');
    } finally {
      setPendingAction(null);
    }
  }, [clusterId]);

  const onFeedback = useCallback(
    async (value: ClusterFeedbackValue) => {
      if (!userId) return;
      setFeedback(value);
      await fetch('/api/admin/research/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId, value }),
      });
    },
    [clusterId, userId],
  );

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={routes.adminResearchCluster(clusterId)}
        className="text-xs font-medium text-brand hover:underline"
      >
        Detaljer
      </Link>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          title="Lik"
          aria-pressed={feedback === 'like'}
          onClick={() => onFeedback('like')}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border hover:bg-muted/50"
        >
          <ThumbsUp className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          title="Ikke lik"
          aria-pressed={feedback === 'dislike'}
          onClick={() => onFeedback('dislike')}
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-border hover:bg-muted/50"
        >
          <ThumbsDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {(['deepen', 'blog', 'reel'] as ResearchApiAction[]).map((action) => (
        <button
          key={action}
          type="button"
          disabled={pendingAction === action}
          onClick={() => runAction(action)}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-background px-2 py-1 text-left text-[11px] font-medium hover:bg-muted/50 disabled:opacity-60"
        >
          {pendingAction === action ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          ) : null}
          {queued.has(action) ? 'I kø' : ACTION_LABELS[action]}
        </button>
      ))}
      {error ? <p className="text-[11px] text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
