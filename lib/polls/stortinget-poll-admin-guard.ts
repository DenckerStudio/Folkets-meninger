import type { PollStatus, PollTrack } from '@/lib/polls/types';

export type IssuePollAdminRow = {
  id: string;
  track: PollTrack | string;
  status: PollStatus | string;
  title: string;
  neutralSummary: string;
  closesAt: string | null;
};

export type StortingetIssueTextSnapshot = {
  title: string | null;
  summary: string | null;
};

export type StortingetPollAdminUiState =
  | { kind: 'blocked_system_poll' }
  | { kind: 'create' }
  | {
      kind: 'editable';
      poll: {
        id: string;
        title: string;
        neutralSummary: string;
        closesAt: string | null;
      };
    }
  | { kind: 'stortinget_draft'; pollId: string; title: string }
  | { kind: 'stortinget_archived'; pollId: string; title: string };

export const STORTINGET_POLL_ADMIN_BLOCKED_HEADING = 'Saken har en avviklet systemavstemning';

export const STORTINGET_POLL_ADMIN_BLOCKED_BODY =
  'Saken har allerede en eldre systemavstemning fra Utforsk. Da kan vi ikke opprette en ny Stortinget-avstemning fra denne saksiden ennå.';

export const STORTINGET_POLL_ADMIN_BLOCKED_NEXT =
  'Vi åpner for manuell Stortinget-avstemning på slike saker senere. Ingen handling er nødvendig nå.';

export const STORTINGET_POLL_ADMIN_DRAFT_MESSAGE = 'Avstemningen er en kladd.';

export const STORTINGET_POLL_ADMIN_ARCHIVED_MESSAGE = 'Avstemningen er arkivert.';

export const STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR =
  'Saken har en avviklet systemavstemning og kan ikke få ny Stortinget-avstemning her ennå.';

export const STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR =
  'Avstemningen ligger som kladd og kan ikke redigeres her.';

export const STORTINGET_POLL_ADMIN_ARCHIVED_ACTION_ERROR =
  'Avstemningen er arkivert og kan ikke redigeres her.';

function isStortingetTrack(track: string): track is 'stortinget' {
  return track === 'stortinget';
}

function isEditableStortingetStatus(status: string): boolean {
  return status === 'open' || status === 'closed';
}

export function resolveStortingetPollAdminUiState(rows: IssuePollAdminRow[]): StortingetPollAdminUiState {
  if (rows.some((row) => !isStortingetTrack(String(row.track).trim()))) {
    return { kind: 'blocked_system_poll' };
  }

  const stortingetRows = rows.filter((row) => isStortingetTrack(String(row.track).trim()));
  const editable = stortingetRows.find((row) => isEditableStortingetStatus(String(row.status).trim()));
  if (editable) {
    return {
      kind: 'editable',
      poll: {
        id: editable.id,
        title: editable.title,
        neutralSummary: editable.neutralSummary,
        closesAt: editable.closesAt,
      },
    };
  }

  const draft = stortingetRows.find((row) => String(row.status).trim() === 'draft');
  if (draft) {
    return { kind: 'stortinget_draft', pollId: draft.id, title: draft.title };
  }

  const archived = stortingetRows.find((row) => String(row.status).trim() === 'archived');
  if (archived) {
    return { kind: 'stortinget_archived', pollId: archived.id, title: archived.title };
  }

  return { kind: 'create' };
}

export function validateStortingetPollAdminAction(
  rows: IssuePollAdminRow[],
  options: { isUpdate: boolean },
): { ok: true; mode: 'create' | 'update' } | { ok: false; error: string } {
  const ui = resolveStortingetPollAdminUiState(rows);
  if (ui.kind === 'blocked_system_poll') {
    return { ok: false, error: STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR };
  }
  if (ui.kind === 'stortinget_draft') {
    return { ok: false, error: STORTINGET_POLL_ADMIN_DRAFT_ACTION_ERROR };
  }
  if (ui.kind === 'stortinget_archived') {
    return { ok: false, error: STORTINGET_POLL_ADMIN_ARCHIVED_ACTION_ERROR };
  }
  if (options.isUpdate) {
    if (ui.kind !== 'editable') {
      return { ok: false, error: 'Fant ingen avstemning å oppdatere.' };
    }
    return { ok: true, mode: 'update' };
  }
  if (ui.kind === 'editable') {
    return { ok: false, error: 'Avstemningen finnes allerede. Bruk rediger.' };
  }
  if (ui.kind !== 'create') {
    return { ok: false, error: STORTINGET_POLL_ADMIN_BLOCKED_ACTION_ERROR };
  }
  return { ok: true, mode: 'create' };
}

export function issueTextSnapshotEquals(
  a: StortingetIssueTextSnapshot | null,
  b: StortingetIssueTextSnapshot | null,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.title === b.title && a.summary === b.summary;
}
