'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Clapperboard, Loader2, Microscope } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { SmoothDropdown } from '@/components/ui/smooth-dropdown';
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
}: {
  clusterId: string;
  userId?: string;
  variant?: 'full' | 'table-compact';
  initialBriefsByKind?: ResearchBriefsByKind;
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

  const tableMenuItems = ACTIONS.map((action) => ({
    id: action,
    label: RESEARCH_ACTION_LABELS[action],
    icon: ACTION_ICONS[action],
    type: 'item' as const,
  }));

  return (
    <>
      <div className={cn(variant === 'table-compact' ? 'flex items-center gap-2' : 'flex flex-col gap-2')}>
        {variant === 'table-compact' ? (
          <SmoothDropdown
            items={tableMenuItems}
            onSelect={(id) => onRequest(id as ResearchApiAction)}
            triggerAriaLabel="Handlinger"
            triggerContent={
              <span className="text-xs font-medium text-foreground">Handlinger</span>
            }
            className="shrink-0"
          />
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
          <p className={cn('text-destructive', variant === 'full' ? 'text-xs' : 'text-xs')} role="alert">
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
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => confirmAndRun()}
              disabled={pendingAction !== null}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
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
