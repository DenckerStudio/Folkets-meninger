'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Columns3 } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { formatWhen } from '@/components/appens-fremtid/format';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { resolveDevTaskProposalDecision } from '@/lib/admin/dev-task-proposals/transitions';
import {
  DEV_TASK_PROPOSAL_STATUSES,
  type DevTaskProposalDecisionAction,
  type DevTaskProposalRow,
  type DevTaskProposalStatus,
} from '@/lib/admin/dev-task-proposals/types';
import { cn } from '@/lib/utils';

const KANBAN_GRID_CLASS = 'grid gap-4 lg:grid-cols-2 xl:grid-cols-4';

const COLUMN_META: Record<
  DevTaskProposalStatus,
  { title: string; empty: string }
> = {
  til_godkjenning: {
    title: 'Til godkjenning',
    empty: 'Ingen forslag venter på godkjenning.',
  },
  i_prosess: {
    title: 'I prosess',
    empty: 'Ingen oppgaver er i gang akkurat nå.',
  },
  ferdig: {
    title: 'Ferdig',
    empty: 'Ingen fullførte oppgaver å vise.',
  },
  avslatt: {
    title: 'Avslått',
    empty: 'Ingen avslåtte forslag.',
  },
};

const LINK_TOUCH_CLASS = cn(
  'inline-flex min-h-11 items-center text-xs font-medium text-brand hover:underline',
  VURDER_FOCUS_RING,
);

function riskLabel(risk: DevTaskProposalRow['risk']): string {
  return risk === 'low' ? 'Lav' : 'Normal';
}

function riskBadgeClass(risk: DevTaskProposalRow['risk']): string {
  return risk === 'low'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'bg-muted text-muted-foreground';
}

function applyOptimisticDecision(
  proposals: DevTaskProposalRow[],
  id: string,
  action: DevTaskProposalDecisionAction,
): DevTaskProposalRow[] | null {
  const current = proposals.find((p) => p.id === id);
  if (!current) return null;
  const transition = resolveDevTaskProposalDecision(current.status, action);
  if (!transition.ok) return null;
  const now = new Date().toISOString();
  return proposals.map((p) =>
    p.id === id
      ? {
          ...p,
          status: transition.nextStatus,
          decided_at: now,
        }
      : p,
  );
}

function ProposalCard({
  proposal,
  onGodkjenn,
  onRequestAvslå,
  onConfirmAvslå,
  onCancelAvslå,
  pendingId,
  pendingAction,
  rejectConfirmId,
  inlineError,
}: {
  proposal: DevTaskProposalRow;
  onGodkjenn: (id: string) => void;
  onRequestAvslå: (id: string) => void;
  onConfirmAvslå: (id: string) => void;
  onCancelAvslå: () => void;
  pendingId: string | null;
  pendingAction: DevTaskProposalDecisionAction | null;
  rejectConfirmId: string | null;
  inlineError: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const avbrytRef = useRef<HTMLButtonElement>(null);
  const body = proposal.body?.trim() ?? '';
  const showActions = proposal.status === 'til_godkjenning';
  const busy = pendingId === proposal.id;
  const confirmingReject = rejectConfirmId === proposal.id;

  useEffect(() => {
    if (confirmingReject) {
      avbrytRef.current?.focus();
    }
  }, [confirmingReject]);

  return (
    <article className="rounded-lg border border-border bg-background p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{proposal.title}</h3>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            riskBadgeClass(proposal.risk),
          )}
        >
          {riskLabel(proposal.risk)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Kilde: {proposal.source}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Opprettet {formatWhen(proposal.created_at)}
      </p>

      {proposal.status === 'i_prosess' && proposal.slack_posted_at ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground">Postet i Slack</p>
      ) : null}

      {proposal.status === 'i_prosess' && !proposal.pr_url ? (
        <p className="mt-2 text-xs font-medium text-brand">Venter på PR</p>
      ) : null}

      {proposal.pr_url ? (
        <p className="mt-2">
          <Link
            href={proposal.pr_url}
            className={LINK_TOUCH_CLASS}
            target="_blank"
            rel="noopener noreferrer"
          >
            Åpne pull request
          </Link>
        </p>
      ) : null}

      {body ? (
        <div className="mt-2">
          <p className={cn('text-sm text-foreground', !expanded && 'line-clamp-3')}>{body}</p>
          {body.length > 160 ? (
            <button
              type="button"
              className={cn('mt-1', LINK_TOUCH_CLASS)}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Vis mindre' : 'Vis mer'}
            </button>
          ) : null}
        </div>
      ) : null}

      {inlineError ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {inlineError}
        </p>
      ) : null}

      {showActions && !confirmingReject ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            className={cn('min-h-11', VURDER_FOCUS_RING)}
            disabled={busy}
            aria-busy={busy && pendingAction === 'godkjenn'}
            onClick={() => onGodkjenn(proposal.id)}
          >
            {busy && pendingAction === 'godkjenn' ? 'Godkjenner …' : 'Godkjenn'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn('min-h-11', VURDER_FOCUS_RING)}
            disabled={busy}
            onClick={() => onRequestAvslå(proposal.id)}
          >
            Avslå
          </Button>
        </div>
      ) : null}

      {showActions && confirmingReject ? (
        <div
          className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-3"
          role="region"
          aria-label="Bekreft avslag"
        >
          <p className="text-sm font-medium text-foreground">Avslå forslaget?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              className={cn('min-h-11', VURDER_FOCUS_RING)}
              disabled={busy}
              aria-busy={busy && pendingAction === 'avslå'}
              onClick={() => onConfirmAvslå(proposal.id)}
            >
              {busy && pendingAction === 'avslå' ? 'Avslår …' : 'Avslå'}
            </Button>
            <Button
              ref={avbrytRef}
              type="button"
              variant="outline"
              className={cn('min-h-11', VURDER_FOCUS_RING)}
              disabled={busy}
              onClick={onCancelAvslå}
            >
              Avbryt
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function KanbanColumn({
  status,
  items,
  boardLoading,
  boardError,
  onGodkjenn,
  onRequestAvslå,
  onConfirmAvslå,
  onCancelAvslå,
  pendingId,
  pendingAction,
  rejectConfirmId,
  cardErrors,
}: {
  status: DevTaskProposalStatus;
  items: DevTaskProposalRow[];
  boardLoading: boolean;
  boardError: boolean;
  onGodkjenn: (id: string) => void;
  onRequestAvslå: (id: string) => void;
  onConfirmAvslå: (id: string) => void;
  onCancelAvslå: () => void;
  pendingId: string | null;
  pendingAction: DevTaskProposalDecisionAction | null;
  rejectConfirmId: string | null;
  cardErrors: Record<string, string>;
}) {
  const meta = COLUMN_META[status];

  return (
    <section className="flex min-h-[16rem] flex-col rounded-xl border border-border bg-card p-3">
      <header className="mb-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-foreground">{meta.title}</h2>
        {!boardError && !boardLoading ? (
          <p className="text-xs text-muted-foreground">{items.length} forslag</p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2">
        {boardLoading ? (
          <p className="text-sm text-muted-foreground">Laster …</p>
        ) : boardError ? null : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{meta.empty}</p>
        ) : (
          items.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onGodkjenn={onGodkjenn}
              onRequestAvslå={onRequestAvslå}
              onConfirmAvslå={onConfirmAvslå}
              onCancelAvslå={onCancelAvslå}
              pendingId={pendingId}
              pendingAction={pendingAction}
              rejectConfirmId={rejectConfirmId}
              inlineError={cardErrors[proposal.id] ?? ''}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted/60', className)} />;
}

export function OppgaverPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Laster oppgaver">
      <SkeletonBlock className="h-10 w-56" />
      <div className={KANBAN_GRID_CLASS}>
        {DEV_TASK_PROPOSAL_STATUSES.map((status) => (
          <div
            key={status}
            className="flex min-h-[16rem] flex-col rounded-xl border border-border bg-card p-3"
          >
            <div className="mb-3 space-y-2 border-b border-border pb-2">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <SkeletonBlock className="min-h-[7rem] w-full rounded-lg" />
              <SkeletonBlock className="min-h-[7rem] w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminOppgaverClient() {
  const [proposals, setProposals] = useState<DevTaskProposalRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DevTaskProposalDecisionAction | null>(null);
  const [rejectConfirmId, setRejectConfirmId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const fetchProposals = useCallback(async (opts: { showLoading: boolean }) => {
    if (opts.showLoading) {
      setIsInitialLoading(true);
    }
    try {
      const res = await fetch('/api/admin/dev-task-proposals');
      const data = (await res.json().catch(() => ({}))) as {
        proposals?: DevTaskProposalRow[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste oppgaver.');
        if (opts.showLoading) {
          setProposals([]);
        }
      } else {
        setLoadError('');
        setProposals(Array.isArray(data.proposals) ? data.proposals : []);
      }
    } catch {
      setLoadError('Kunne ikke laste oppgaver.');
      if (opts.showLoading) {
        setProposals([]);
      }
    } finally {
      if (opts.showLoading) {
        setIsInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchProposals({ showLoading: true });
  }, [fetchProposals]);

  const columns = useMemo(() => {
    const byStatus = Object.fromEntries(
      DEV_TASK_PROPOSAL_STATUSES.map((s) => [s, [] as DevTaskProposalRow[]]),
    ) as Record<DevTaskProposalStatus, DevTaskProposalRow[]>;
    for (const row of proposals) {
      if (byStatus[row.status]) {
        byStatus[row.status].push(row);
      }
    }
    return byStatus;
  }, [proposals]);

  const clearCardError = (id: string) => {
    setCardErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const runDecision = async (id: string, action: DevTaskProposalDecisionAction) => {
    const current = proposals.find((p) => p.id === id);
    if (!current || current.status !== 'til_godkjenning') {
      setCardErrors((prev) => ({
        ...prev,
        [id]: 'Kortet er allerede behandlet',
      }));
      void fetchProposals({ showLoading: false });
      return;
    }

    const snapshot = proposals;
    const optimistic = applyOptimisticDecision(proposals, id, action);
    if (!optimistic) {
      return;
    }

    clearCardError(id);
    setRejectConfirmId(null);
    setPendingId(id);
    setPendingAction(action);
    setProposals(optimistic);

    try {
      const res = await fetch(`/api/admin/dev-task-proposals/${encodeURIComponent(id)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, currentStatus: 'til_godkjenning' }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (res.status === 409) {
        setProposals(snapshot);
        setCardErrors((prev) => ({
          ...prev,
          [id]: 'Kortet er allerede behandlet',
        }));
        void fetchProposals({ showLoading: false });
        return;
      }

      if (!res.ok) {
        setProposals(snapshot);
        setCardErrors((prev) => ({
          ...prev,
          [id]: typeof data.error === 'string' ? data.error : 'Handlingen feilet.',
        }));
      }
    } catch {
      setProposals(snapshot);
      setCardErrors((prev) => ({
        ...prev,
        [id]: 'Handlingen feilet.',
      }));
    } finally {
      setPendingId(null);
      setPendingAction(null);
    }
  };

  const boardError = Boolean(loadError);

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <Columns3 className="h-6 w-6 shrink-0 text-brand" aria-hidden />
          Oppgaver
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Godkjenn eller avslå auto-genererte forslag før kodeflyten tar over.
        </p>
      </header>

      {loadError ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            className={cn('min-h-11 shrink-0', VURDER_FOCUS_RING)}
            onClick={() => void fetchProposals({ showLoading: true })}
          >
            Prøv igjen
          </Button>
        </div>
      ) : null}

      <div className={KANBAN_GRID_CLASS}>
        {DEV_TASK_PROPOSAL_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            items={columns[status]}
            boardLoading={isInitialLoading}
            boardError={boardError}
            onGodkjenn={(id) => void runDecision(id, 'godkjenn')}
            onRequestAvslå={(id) => {
              clearCardError(id);
              setRejectConfirmId(id);
            }}
            onConfirmAvslå={(id) => void runDecision(id, 'avslå')}
            onCancelAvslå={() => setRejectConfirmId(null)}
            pendingId={pendingId}
            pendingAction={pendingAction}
            rejectConfirmId={rejectConfirmId}
            cardErrors={cardErrors}
          />
        ))}
      </div>
    </div>
  );
}
