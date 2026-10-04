import {
  OPINION_BODY_MAX,
  OPINION_POINTS_MAX,
  OPINION_POINTS_MIN,
  OPINION_POINT_TEXT_MAX,
  OPINION_TITLE_MAX,
  type OpinionCreateStance,
  type OpinionPoint,
} from './types';
import { emptyOpinionPointDrafts, isOpinionCreateStance, isOpinionPointStance } from './validate';

export const OPINION_DRAFT_STORAGE_PREFIX = 'folkets-meninger:opinion-draft';

export type OpinionComposerDraft = {
  title: string;
  issueId: string | null;
  stance: OpinionCreateStance | null;
  body: string;
  points: OpinionPoint[];
};

export type OpinionDraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function opinionDraftStorageKey(userId: string | null | undefined): string {
  const id = userId?.trim();
  if (id) return `${OPINION_DRAFT_STORAGE_PREFIX}:user:${id}`;
  return `${OPINION_DRAFT_STORAGE_PREFIX}:signed-out`;
}

export function hasOpinionComposerDraftContent(draft: OpinionComposerDraft): boolean {
  if (draft.title.trim()) return true;
  if (draft.issueId?.trim()) return true;
  if (draft.stance) return true;
  if (draft.body.trim()) return true;
  const baseline = emptyOpinionPointDrafts();
  if (draft.points.length !== baseline.length) return true;
  return draft.points.some(
    (point, index) => point.text !== baseline[index]?.text || point.stance !== baseline[index]?.stance,
  );
}

export function resolveOpinionComposerDraft(
  editedDuringMount: boolean,
  saved: OpinionComposerDraft | null,
): OpinionComposerDraft | null {
  if (editedDuringMount || !saved) return null;
  if (!hasOpinionComposerDraftContent(saved)) return null;
  return saved;
}

function clampText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

export function parseOpinionComposerDraft(raw: unknown): OpinionComposerDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    title?: unknown;
    issueId?: unknown;
    stance?: unknown;
    body?: unknown;
    points?: unknown;
  };
  if (typeof record.title !== 'string' || typeof record.body !== 'string') return null;
  if (record.issueId !== null && typeof record.issueId !== 'string') return null;
  if (record.stance !== null && !isOpinionCreateStance(record.stance)) return null;
  if (!Array.isArray(record.points)) return null;

  const points: OpinionPoint[] = [];
  for (const item of record.points) {
    if (!item || typeof item !== 'object') return null;
    const point = item as { stance?: unknown; text?: unknown };
    if (!isOpinionPointStance(point.stance) || typeof point.text !== 'string') return null;
    points.push({
      stance: point.stance,
      text: clampText(point.text, OPINION_POINT_TEXT_MAX),
    });
    if (points.length > OPINION_POINTS_MAX) return null;
  }
  if (points.length === 0) return null;
  while (points.length < OPINION_POINTS_MIN) {
    points.push({ stance: 'for', text: '' });
  }

  return {
    title: clampText(record.title, OPINION_TITLE_MAX),
    issueId: record.issueId?.trim() ? record.issueId : null,
    stance: record.stance,
    body: clampText(record.body, OPINION_BODY_MAX),
    points,
  };
}

export function readOpinionComposerDraft(
  storage: OpinionDraftStorage,
  userId: string | null | undefined,
): OpinionComposerDraft | null {
  try {
    const raw = storage.getItem(opinionDraftStorageKey(userId));
    if (!raw) return null;
    return parseOpinionComposerDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeOpinionComposerDraft(
  storage: OpinionDraftStorage,
  userId: string | null | undefined,
  draft: OpinionComposerDraft,
): void {
  try {
    storage.setItem(opinionDraftStorageKey(userId), JSON.stringify(draft));
  } catch {
    // Quota or private mode.
  }
}

export function clearOpinionComposerDraft(
  storage: OpinionDraftStorage,
  userId: string | null | undefined,
): void {
  try {
    storage.removeItem(opinionDraftStorageKey(userId));
  } catch {
    // ignore
  }
}
