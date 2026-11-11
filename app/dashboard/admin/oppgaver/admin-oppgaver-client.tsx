'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Columns3 } from 'lucide-react';
import { AdminBackLink } from '@/components/admin/admin-shell';
import { Button } from '@/components/ui/button';
import { formatWhen } from '@/components/appens-fremtid/format';
import {
  DEV_TASK_PROPOSAL_STATUSES,
  type DevTaskProposalDecisionAction,
  type DevTaskProposalRow,
  type DevTaskProposalStatus,
} from '@/lib/admin/dev-task-proposals/types';
import { cn } from '@/lib/utils';

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

function riskLabel(risk: DevTaskProposalRow['risk']): string {
  return risk === 'low' ? 'Lav' : 'Normal';
}

function riskBadgeClass(risk: DevTaskProposalRow['risk']): string {
  return risk === 'low'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'bg-muted text-muted-foreground';
}

type ColumnState = {
  items: DevTaskProposalRow[];
  loadError: string;
  isLoading: boolean;
};

function ProposalCard({
  proposal,
  onDecision,
  pendingId,
}: {
  proposal: DevTaskProposalRow;
  onDecision: (id: string, action: DevTaskProposalDecisionAction) => void;
  pendingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = proposal.body?.trim() ?? '';
  const showActions = proposal.status === 'til_godkjenning';
  const busy = pendingId === proposal.id;

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
            className="text-xs font-medium text-brand hover:underline"
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
              className="mt-1 text-xs font-medium text-brand hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Vis mindre' : 'Vis mer'}
            </button>
          ) : null}
        </div>
      ) : null}

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onDecision(proposal.id, 'godkjenn')}
          >
            Godkjenn
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onDecision(proposal.id, 'avslå')}
          >
            Avslå
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function KanbanColumn({
  status,
  state,
  onDecision,
  pendingId,
}: {
  status: DevTaskProposalStatus;
  state: ColumnState;
  onDecision: (id: string, action: DevTaskProposalDecisionAction) => void;
  pendingId: string | null;
}) {
  const meta = COLUMN_META[status];

  return (
    <section className="flex min-h-[16rem] flex-col rounded-xl border border-border bg-card p-3">
      <header className="mb-3 border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-foreground">{meta.title}</h2>
        <p className="text-xs text-muted-foreground">{state.items.length} forslag</p>
      </header>

      <div className="flex flex-1 flex-col gap-2">
        {state.isLoading ? (
          <p className="text-sm text-muted-foreground">Laster …</p>
        ) : state.loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {state.loadError}
          </p>
        ) : state.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{meta.empty}</p>
        ) : (
          state.items.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onDecision={onDecision}
              pendingId={pendingId}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function OppgaverPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-4">
        {DEV_TASK_PROPOSAL_STATUSES.map((status) => (
          <div key={status} className="h-64 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

export default function AdminOppgaverClient() {
  const [proposals, setProposals] = useState<DevTaskProposalRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(() => {
    setIsLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/dev-task-proposals');
        const data = (await res.json().catch(() => ({}))) as {
          proposals?: DevTaskProposalRow[];
          error?: string;
        };
        if (!res.ok) {
          setLoadError(typeof data.error === 'string' ? data.error : 'Kunne ikke laste oppgaver.');
          setProposals([]);
        } else {
          setLoadError('');
          setProposals(Array.isArray(data.proposals) ? data.proposals : []);
        }
      } catch {
        setLoadError('Kunne ikke laste oppgaver.');
        setProposals([]);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const columnStates = useMemo(
    () =>
      Object.fromEntries(
        DEV_TASK_PROPOSAL_STATUSES.map((status) => [
          status,
          {
            items: columns[status],
            loadError,
            isLoading,
          } satisfies ColumnState,
        ]),
      ) as Record<DevTaskProposalStatus, ColumnState>,
    [columns, isLoading, loadError],
  );

  const onDecision = (id: string, action: DevTaskProposalDecisionAction) => {
    const current = proposals.find((p) => p.id === id);
    if (!current || current.status !== 'til_godkjenning') {
      setActionError('Forslaget kan ikke behandles lenger.');
      return;
    }
    setActionError('');
    setPendingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/dev-task-proposals/${encodeURIComponent(id)}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, currentStatus: current.status }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setActionError(typeof data.error === 'string' ? data.error : 'Handlingen feilet.');
        } else {
          load();
        }
      } catch {
        setActionError('Handlingen feilet.');
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      <AdminBackLink />
      <div className="flex items-start gap-3">
        <Columns3 className="mt-1 h-6 w-6 shrink-0 text-brand" aria-hidden />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Oppgaver</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Godkjenn eller avslå auto-genererte forslag før kodeflyten tar over.
          </p>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {DEV_TASK_PROPOSAL_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            state={columnStates[status]}
            onDecision={onDecision}
            pendingId={pendingId}
          />
        ))}
      </div>
    </div>
  );
}
