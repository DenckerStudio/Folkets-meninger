'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Clapperboard, Loader2, Microscope } from 'lucide-react';
import { ResearchBriefStatusBadge } from '@/components/admin/research-brief-status-badge';
import { Dialog } from '@/components/ui/dialog';
import { SmoothDropdown, type SmoothDropdownItem } from '@/components/ui/smooth-dropdown';
import type { ResearchApiAction } from '@/lib/admin/research/actions';
import {
  RESEARCH_ACTION_CONFIRM,
  RESEARCH_ACTION_LABELS,
  researchBriefOutputLink,
} from '@/lib/admin/research/labels';
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

const actionButtonClass =
  'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-medium hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60';

function isBusyStatus(status: ResearchBriefStatus | undefined): boolean {
  return status === 'queued' || status === 'running';
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

function buildTableMenuItem(
  action: ResearchApiAction,
  brief?: ResearchBriefSnapshot,
): SmoothDropdownItem {
  const status = brief?.status;
  const baseLabel = RESEARCH_ACTION_LABELS[action];

  if (status === 'queued' || status === 'running') {
    const suffix = status === 'queued' ? 'I kø' : 'Kjører';
    return {
      id: action,
      label: `${baseLabel} · ${suffix}`,
      icon: ACTION_ICONS[action],
      type: 'item',
      disabled: true,
    };
  }

  if (status === 'done') {
    const output =
      brief && researchBriefOutputLink(brief.kind, brief.output_ref, brief.status);
    if (output) {
      return {
        id: action,
        label: DONE_MENU_LABELS[action],
        icon: ACTION_ICONS[action],
        type: 'item',
        href: output.href,
      };
    }
    return {
      id: action,
      label: 'Ferdig',
      icon: ACTION_ICONS[action],
      type: 'item',
      disabled: true,
    };
  }

  if (status === 'failed') {
    return {
      id: action,
      label: `Prøv igjen: ${baseLabel}`,
      icon: ACTION_ICONS[action],
      type: 'item',
      destructive: true,
    };
  }

  return {
    id: action,
    label: baseLabel,
    icon: ACTION_ICONS[action],
    type: 'item',
  };
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
  pendingAction,
  onRequest,
}: {
  action: ResearchApiAction;
  brief?: ResearchBriefSnapshot;
  pendingAction: ResearchApiAction | null;
  onRequest: (action: ResearchApiAction) => void;
}) {
  const status = brief?.status;
  const busy = isBusyStatus(status);
  const failed = status === 'failed';
  const done = status === 'done';
  const output = brief ? researchBriefOutputLink(brief.kind, brief.output_ref, brief.status) : null;
  const showSpinner = pendingAction === action || status === 'running';

  let label = RESEARCH_ACTION_LABELS[action];
  if (status === 'queued') label = 'I kø';
  else if (status === 'running') label = 'Kjører';
  else if (done && output) label = output.label;
  else if (done) label = 'Ferdig';
  else if (failed) label = 'Prøv igjen';

  const disabled = busy || (pendingAction !== null && pendingAction !== action);
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

export function ResearchRowActions({
  clusterId,
  userId,
  variant = 'full',
  initialBriefsByKind = {},
  defaultMenuOpen = false,
}: {
  clusterId: string;
  userId?: string;
  variant?: 'full' | 'table-compact';
  initialBriefsByKind?: ResearchBriefsByKind;
  /** Kun for lokal forhåndsvisning; ikke bruk i prod. */
  defaultMenuOpen?: boolean;
}) {
  const router = useRouter();
  const [briefsByKind, setBriefsByKind] = useState<ResearchBriefsByKind>(initialBriefsByKind);
  const [pendingAction, setPendingAction] = useState<ResearchApiAction | null>(null);
  const [confirmAction, setConfirmAction] = useState<ResearchApiAction | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setBriefsByKind(initialBriefsByKind);
  }, [initialBriefsByKind]);

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
          request_id?: string;
          status?: ResearchBriefStatus;
          created?: boolean;
        };
        if (res.status === 401 || res.status === 403) {
          setError('Ingen tilgang');
          return;
        }
        if (res.status === 409 && body.request_id) {
          setBriefsByKind((prev) =>
            mergeBriefFromResponse(prev, action, body.status ?? 'queued', body.request_id!),
          );
          return;
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
      if (isBusyStatus(brief?.status)) return;
      setPendingRequestId(crypto.randomUUID());
      setConfirmAction(action);
    },
    [briefsByKind],
  );

  const confirmAndRun = useCallback(() => {
    if (!confirmAction) return;
    const requestId = pendingRequestId ?? crypto.randomUUID();
    if (!pendingRequestId) setPendingRequestId(requestId);
    void runAction(confirmAction, requestId);
  }, [confirmAction, pendingRequestId, runAction]);

  const tableMenuItems = useMemo(
    () => ACTIONS.map((action) => buildTableMenuItem(action, briefsByKind[action])),
    [briefsByKind],
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

  return (
    <>
      <div className={cn(variant === 'table-compact' ? 'flex items-center gap-2' : 'flex flex-col gap-2')}>
        {variant === 'table-compact' ? (
          <>
            {highlightBrief ? (
              <ResearchBriefStatusBadge status={highlightBrief.status} />
            ) : null}
            <SmoothDropdown
              items={tableMenuItems}
              onSelect={onTableMenuSelect}
              triggerAriaLabel="Handlinger"
              defaultOpen={defaultMenuOpen}
              triggerContent={
                <span className="text-xs font-medium text-foreground">Handlinger</span>
              }
              className="shrink-0 !h-11 !w-auto min-w-[6.75rem]"
            />
          </>
        ) : (
          ACTIONS.map((action) => (
            <ResearchActionButton
              key={action}
              action={action}
              brief={briefsByKind[action]}
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

      <Dialog
        open={confirmAction !== null}
        onClose={() => {
          if (pendingAction === null) setConfirmAction(null);
        }}
        title="Bekreft handling"
        description={confirmAction ? RESEARCH_ACTION_CONFIRM[confirmAction] : undefined}
        size="md"
        className="sm:max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
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
    </>
  );
}
