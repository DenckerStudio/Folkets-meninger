'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ChevronDown,
  Clapperboard,
  Loader2,
  Microscope,
  MoreHorizontal,
} from 'lucide-react';
import { ResearchBriefStatusBadge } from '@/components/admin/research-brief-status-badge';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog } from '@/components/ui/dialog';
import type { ResearchApiAction } from '@/lib/admin/research/actions';
import {
  RESEARCH_API_ERROR_CODES,
  researchApiErrorMessage,
} from '@/lib/admin/research/api-error-codes';
import {
  RESEARCH_ACTION_CONFIRM,
  RESEARCH_ACTION_LABELS,
  RESEARCH_KIND_LABELS,
  researchBriefOutputLink,
} from '@/lib/admin/research/labels';
import {
  mergeActiveBriefFromConflict,
  resolveResearchEnqueueConflict,
} from '@/lib/admin/research/enqueue-response';
import {
  hasActiveResearchBriefs,
  RESEARCH_BRIEF_POLL_MS,
} from '@/lib/admin/research/polling';
import type { ResearchBriefSnapshot, ResearchBriefsByKind } from '@/lib/admin/research/service';
import type { ResearchBriefStatus } from '@/lib/admin/research/types';
import { cn } from '@/lib/utils';

const ACTIONS: ResearchApiAction[] = ['deepen', 'blog', 'reel'];

const DONE_MENU_LABELS: Record<ResearchApiAction, string> = {
  deepen: 'Se utdyping',
  blog: 'Åpne bloggutkast',
  reel: 'Åpne Reel',
};

const ACTION_ICONS: Record<ResearchApiAction, typeof Microscope> = {
  deepen: Microscope,
  blog: BookOpen,
  reel: Clapperboard,
};

export type ResearchTableMenuItem = {
  id: string;
  label: string;
  icon: (typeof ACTION_ICONS)[ResearchApiAction] | null;
  disabled?: boolean;
  destructive?: boolean;
  href?: string;
};

const actionButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60';

function isBusyStatus(status: ResearchBriefStatus | undefined): boolean {
  return status === 'queued' || status === 'running';
}

function isDoneWithoutRerun(brief?: ResearchBriefSnapshot, clusterId?: string): boolean {
  if (!brief || brief.status !== 'done') return false;
  return !researchBriefOutputLink(brief.kind, brief.output_ref, brief.status, { clusterId });
}

function statusPriority(status: ResearchBriefStatus | undefined): number {
  switch (status) {
    case 'running':
      return 0;
    case 'queued':
      return 1;
    case 'failed':
      return 2;
    case 'done':
      return 3;
    default:
      return 4;
  }
}

function pickHighlightBrief(briefsByKind: ResearchBriefsByKind): ResearchBriefSnapshot | null {
  let best: ResearchBriefSnapshot | null = null;
  let bestPriority = 4;
  for (const action of ACTIONS) {
    const brief = briefsByKind[action];
    if (!brief) continue;
    const priority = statusPriority(brief.status);
    if (priority < bestPriority) {
      bestPriority = priority;
      best = brief;
    }
  }
  return best;
}

export function buildResearchTableMenuItem(
  action: ResearchApiAction,
  brief?: ResearchBriefSnapshot,
  clusterId?: string,
): ResearchTableMenuItem {
  const status = brief?.status;
  const baseLabel = RESEARCH_ACTION_LABELS[action];

  if (status === 'queued' || status === 'running') {
    const suffix = status === 'queued' ? 'I kø' : 'Kjører';
    return {
      id: action,
      label: `${baseLabel} · ${suffix}`,
      icon: ACTION_ICONS[action],
      disabled: true,
    };
  }

  if (status === 'done') {
    const output =
      brief &&
      researchBriefOutputLink(brief.kind, brief.output_ref, brief.status, { clusterId });
    if (output) {
      return {
        id: action,
        label: output.label,
        icon: ACTION_ICONS[action],
        href: output.href,
      };
    }
    return {
      id: action,
      label: 'Ferdig',
      icon: ACTION_ICONS[action],
      disabled: true,
    };
  }

  if (status === 'failed') {
    return {
      id: action,
      label: `${RESEARCH_KIND_LABELS[action]} feilet – Prøv igjen`,
      icon: ACTION_ICONS[action],
      destructive: true,
    };
  }

  return {
    id: action,
    label: baseLabel,
    icon: ACTION_ICONS[action],
  };
}

export function getResearchTableMenuItems(
  briefsByKind: ResearchBriefsByKind,
  clusterId: string,
): ResearchTableMenuItem[] {
  return ACTIONS.map((action) => buildResearchTableMenuItem(action, briefsByKind[action], clusterId));
}

function ResearchTableMenuDropdown({
  items,
  onSelect,
  triggerClassName,
}: {
  items: ResearchTableMenuItem[];
  onSelect: (id: string) => void;
  triggerClassName?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'min-h-11 shrink-0 gap-1 px-2.5',
          triggerClassName,
        )}
        aria-label="Handlinger"
      >
        <span className="hidden min-[640px]:inline">Handlinger</span>
        <MoreHorizontal className="min-[640px]:hidden" aria-hidden />
        <ChevronDown className="hidden size-3.5 opacity-70 min-[640px]:inline" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[100] !w-max min-w-52 max-w-[min(20rem,calc(100vw-2rem))]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const itemClassName =
            'min-h-11 items-start gap-2 py-2.5 text-left whitespace-normal';
          const content = (
            <>
              {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
              <span className="min-w-0 flex-1 whitespace-normal leading-snug">{item.label}</span>
            </>
          );

          if (item.href && !item.disabled) {
            return (
              <DropdownMenuItem
                key={item.id}
                className={itemClassName}
                variant={item.destructive ? 'destructive' : 'default'}
                render={<Link href={item.href} />}
                nativeButton={false}
              >
                {content}
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem
              key={item.id}
              className={itemClassName}
              disabled={item.disabled}
              variant={item.destructive ? 'destructive' : 'default'}
              onClick={() => {
                if (!item.disabled) onSelect(item.id);
              }}
            >
              {content}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function mergeBriefFromResponse(
  prev: ResearchBriefsByKind,
  action: ResearchApiAction,
  status: ResearchBriefStatus,
  requestId: string,
): ResearchBriefsByKind {
  return {
    ...prev,
    [action]: {
      kind: action,
      status,
      output_ref: prev[action]?.output_ref ?? null,
      request_id: requestId,
    },
  };
}

function ResearchActionButton({
  action,
  brief,
  clusterId,
  pendingAction,
  onRequest,
}: {
  action: ResearchApiAction;
  brief?: ResearchBriefSnapshot;
  clusterId: string;
  pendingAction: ResearchApiAction | null;
  onRequest: (action: ResearchApiAction) => void;
}) {
  const status = brief?.status;
  const busy = isBusyStatus(status);
  const failed = status === 'failed';
  const done = status === 'done';
  const output = brief
    ? researchBriefOutputLink(brief.kind, brief.output_ref, brief.status, { clusterId })
    : null;
  const showSpinner = pendingAction === action || status === 'running';

  let label = RESEARCH_ACTION_LABELS[action];
  if (status === 'queued') label = `${RESEARCH_KIND_LABELS[action]} · I kø`;
  else if (status === 'running') label = `${RESEARCH_KIND_LABELS[action]} · Kjører`;
  else if (done && output) label = output.label;
  else if (done && action === 'deepen') label = DONE_MENU_LABELS.deepen;
  else if (done) label = 'Ferdig';
  else if (failed) label = `${RESEARCH_KIND_LABELS[action]} feilet – Prøv igjen`;

  const doneBlocked = isDoneWithoutRerun(brief, clusterId);
  const disabled =
    busy || doneBlocked || (pendingAction !== null && pendingAction !== action);
  const destructive = failed && !busy;

  if (done && output) {
    return (
      <Link
        href={output.href}
        className={cn(
          actionButtonClass,
          'text-brand hover:underline',
          'bg-emerald-500/5 border-emerald-500/20',
        )}
      >
        {label}
      </Link>
    );
  }

  if (doneBlocked) {
    return (
      <button type="button" disabled className={cn(actionButtonClass, 'opacity-60')}>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onRequest(action)}
      className={cn(
        actionButtonClass,
        destructive && 'border-destructive/40 text-destructive hover:bg-destructive/10',
      )}
    >
      {showSpinner ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span>{label}</span>
    </button>
  );
}

function ResearchRowActionsConfirmDialog({
  confirmAction,
  pendingAction,
  confirmAndRun,
  onDismissConfirm,
}: {
  confirmAction: ResearchApiAction | null;
  pendingAction: ResearchApiAction | null;
  confirmAndRun: () => void;
  onDismissConfirm: () => void;
}) {
  return (
    <Dialog
      open={confirmAction !== null}
      onClose={() => {
        if (pendingAction === null) onDismissConfirm();
      }}
      title="Bekreft handling"
      description={confirmAction ? RESEARCH_ACTION_CONFIRM[confirmAction] : undefined}
      size="md"
      className="sm:max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismissConfirm}
            disabled={pendingAction !== null}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => confirmAndRun()}
            disabled={pendingAction !== null}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
          >
            {pendingAction !== null ? 'Starter…' : 'Fortsett'}
          </button>
        </div>
      }
    >
      <span className="sr-only">Bekreft research-handling</span>
    </Dialog>
  );
}

function useResearchRowActions(clusterId: string, initialBriefsByKind: ResearchBriefsByKind) {
  const router = useRouter();
  const [briefsByKind, setBriefsByKind] = useState<ResearchBriefsByKind>(initialBriefsByKind);
  const [pendingAction, setPendingAction] = useState<ResearchApiAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ResearchApiAction | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setBriefsByKind(initialBriefsByKind);
  }, [initialBriefsByKind]);

  const hasActiveBriefs = useMemo(() => hasActiveResearchBriefs(briefsByKind), [briefsByKind]);

  useEffect(() => {
    if (!hasActiveBriefs) return;

    let cancelled = false;

    const pollBriefs = async () => {
      if (document.visibilityState === 'hidden' || cancelled) return;
      try {
        const res = await fetch(`/api/admin/research/clusters/${clusterId}/briefs`);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { briefs_by_kind?: ResearchBriefsByKind };
        const next = body.briefs_by_kind ?? {};
        setBriefsByKind((prev) => ({ ...prev, ...next }));
        if (!hasActiveResearchBriefs(next)) {
          router.refresh();
        }
      } catch {
        // Ignorer nettverksfeil ved polling
      }
    };

    void pollBriefs();
    const intervalId = window.setInterval(() => {
      void pollBriefs();
    }, RESEARCH_BRIEF_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clusterId, hasActiveBriefs, router]);

  const runAction = useCallback(
    async (action: ResearchApiAction, requestId: string) => {
      setError('');
      setPendingAction(action);
      setPendingRequestId(requestId);
      try {
        const res = await fetch(`/api/admin/research/${clusterId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ request_id: requestId }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          request_id?: string;
          status?: ResearchBriefStatus;
          created?: boolean;
        };
        if (res.status === 401 || res.status === 403) {
          setError('Ingen tilgang');
          return;
        }
        if (res.status === 409) {
          const conflict = resolveResearchEnqueueConflict(
            action,
            body,
            body.error === RESEARCH_API_ERROR_CODES.requestConflict
              ? researchApiErrorMessage(RESEARCH_API_ERROR_CODES.requestConflict)
              : researchApiErrorMessage(RESEARCH_API_ERROR_CODES.briefActive),
          );
          if (conflict.kind === 'message_only') {
            setError(conflict.message);
            return;
          }
          if (conflict.kind === 'sync_active') {
            setError(conflict.message);
            setBriefsByKind((prev) =>
              mergeActiveBriefFromConflict(
                prev,
                conflict.action,
                conflict.requestId,
                conflict.status,
              ),
            );
            return;
          }
        }
        if (!res.ok) {
          setError(body.error ?? 'Kunne ikke starte oppgaven');
          return;
        }
        const resolvedId =
          typeof body.request_id === 'string' ? body.request_id : requestId;
        const status = body.status ?? 'queued';
        setBriefsByKind((prev) => mergeBriefFromResponse(prev, action, status, resolvedId));
        if (body.created !== false) {
          router.refresh();
        }
      } catch {
        setError('Kunne ikke starte oppgaven');
      } finally {
        setPendingAction(null);
        setPendingRequestId(null);
        setConfirmAction(null);
      }
    },
    [clusterId, router],
  );

  const onRequest = useCallback(
    (action: ResearchApiAction) => {
      const brief = briefsByKind[action];
      if (isBusyStatus(brief?.status) || isDoneWithoutRerun(brief, clusterId)) return;
      setPendingRequestId(crypto.randomUUID());
      setConfirmAction(action);
    },
    [briefsByKind, clusterId],
  );

  const confirmAndRun = useCallback(() => {
    if (!confirmAction) return;
    const requestId = pendingRequestId ?? crypto.randomUUID();
    if (!pendingRequestId) setPendingRequestId(requestId);
    void runAction(confirmAction, requestId);
  }, [confirmAction, pendingRequestId, runAction]);

  const tableMenuItems = useMemo(
    () => getResearchTableMenuItems(briefsByKind, clusterId),
    [briefsByKind, clusterId],
  );

  const highlightBrief = useMemo(() => pickHighlightBrief(briefsByKind), [briefsByKind]);

  const onTableMenuSelect = useCallback(
    (id: string) => {
      const item = tableMenuItems.find((entry) => entry.id === id);
      if (item?.disabled || item?.href) return;
      onRequest(id as ResearchApiAction);
    },
    [onRequest, tableMenuItems],
  );

  const dismissConfirm = useCallback(() => setConfirmAction(null), []);

  return {
    briefsByKind,
    pendingAction,
    confirmAction,
    error,
    onRequest,
    confirmAndRun,
    dismissConfirm,
    tableMenuItems,
    highlightBrief,
    onTableMenuSelect,
  };
}

export function ResearchRowTableCells({
  clusterId,
  initialBriefsByKind = {},
  researchCellClassName,
  actionsCellClassName,
}: {
  clusterId: string;
  initialBriefsByKind?: ResearchBriefsByKind;
  researchCellClassName?: string;
  actionsCellClassName?: string;
}) {
  const {
    briefsByKind,
    pendingAction,
    confirmAction,
    error,
    confirmAndRun,
    dismissConfirm,
    tableMenuItems,
    highlightBrief,
    onTableMenuSelect,
  } = useResearchRowActions(clusterId, initialBriefsByKind);

  return (
    <>
      <td className={researchCellClassName}>
        {highlightBrief ? (
          <ResearchBriefStatusBadge status={highlightBrief.status} kind={highlightBrief.kind} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </td>
      <td className={actionsCellClassName}>
        <div className="flex justify-end">
          <ResearchTableMenuDropdown items={tableMenuItems} onSelect={onTableMenuSelect} />
        </div>
      </td>
      <ResearchRowActionsConfirmDialog
        confirmAction={confirmAction}
        pendingAction={pendingAction}
        confirmAndRun={confirmAndRun}
        onDismissConfirm={dismissConfirm}
      />
    </>
  );
}

export function ResearchRowActions({
  clusterId,
  variant = 'full',
  initialBriefsByKind = {},
}: {
  clusterId: string;
  variant?: 'full' | 'table-compact';
  initialBriefsByKind?: ResearchBriefsByKind;
}) {
  const {
    briefsByKind,
    pendingAction,
    confirmAction,
    error,
    onRequest,
    confirmAndRun,
    dismissConfirm,
    tableMenuItems,
    highlightBrief,
    onTableMenuSelect,
  } = useResearchRowActions(clusterId, initialBriefsByKind);

  return (
    <>
      <div className={cn(variant === 'table-compact' ? 'flex flex-col gap-2' : 'flex flex-col gap-2')}>
        {variant === 'table-compact' ? (
          <>
            {highlightBrief ? (
              <ResearchBriefStatusBadge status={highlightBrief.status} kind={highlightBrief.kind} />
            ) : null}
            <ResearchTableMenuDropdown items={tableMenuItems} onSelect={onTableMenuSelect} />
          </>
        ) : (
          ACTIONS.map((action) => (
            <ResearchActionButton
              key={action}
              action={action}
              brief={briefsByKind[action]}
              clusterId={clusterId}
              pendingAction={pendingAction}
              onRequest={onRequest}
            />
          ))
        )}
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <ResearchRowActionsConfirmDialog
        confirmAction={confirmAction}
        pendingAction={pendingAction}
        confirmAndRun={confirmAndRun}
        onDismissConfirm={dismissConfirm}
      />
    </>
  );
}
