import type { ForumContextItem } from '@/lib/forum/context';

const STORAGE_KEY = 'folkets-forum-thread-draft';

export type ForumThreadDraft = {
  title: string;
  body: string;
  primarySakId: string | null;
  primarySakTitle: string | null;
  linkedItems: ForumContextItem[];
  savedAt: string;
};

function isDraftItem(value: unknown): value is ForumContextItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as ForumContextItem;
  return (
    typeof item.kind === 'string' &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.href === 'string'
  );
}

function parseDraft(raw: string): ForumThreadDraft | null {
  try {
    const data = JSON.parse(raw) as Partial<ForumThreadDraft>;
    if (typeof data.title !== 'string' || typeof data.body !== 'string') return null;
    const linkedItems = Array.isArray(data.linkedItems)
      ? data.linkedItems.filter(isDraftItem)
      : [];
    return {
      title: data.title,
      body: data.body,
      primarySakId: typeof data.primarySakId === 'string' ? data.primarySakId : null,
      primarySakTitle: typeof data.primarySakTitle === 'string' ? data.primarySakTitle : null,
      linkedItems,
      savedAt: typeof data.savedAt === 'string' ? data.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function hasMeaningfulDraft(draft: ForumThreadDraft): boolean {
  return (
    draft.title.trim().length > 0 ||
    draft.body.trim().length > 0 ||
    draft.linkedItems.length > 0
  );
}

export function loadForumThreadDraft(): ForumThreadDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft = parseDraft(raw);
    if (!draft || !hasMeaningfulDraft(draft)) return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveForumThreadDraft(
  draft: Omit<ForumThreadDraft, 'savedAt'>
): void {
  if (typeof window === 'undefined') return;
  if (
    !draft.title.trim() &&
    !draft.body.trim() &&
    draft.linkedItems.length === 0
  ) {
    clearForumThreadDraft();
    return;
  }

  try {
    const payload: ForumThreadDraft = {
      ...draft,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — ignore
  }
}

export function clearForumThreadDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
