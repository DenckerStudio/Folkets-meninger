export const BLOG_DRAFT_SAVE_SUCCESS_MESSAGE = 'Utkastet er lagret.';

export const BLOG_DRAFT_SAVE_SUCCESS_MIN_MS = 4000;

export type BlogDraftEditServerSnapshot = {
  id: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  updatedAt?: string | null;
};

export function blogDraftEditServerFingerprint(draft: BlogDraftEditServerSnapshot): string {
  return [
    draft.id,
    draft.updatedAt ?? '',
    draft.title,
    draft.excerpt,
    draft.bodyMarkdown,
  ].join('\u0001');
}

/** Sync local form state from CMS when the user has not made unsaved edits. */
export function shouldSyncBlogDraftFieldsFromServer(dirty: boolean): boolean {
  return !dirty;
}

export function shouldShowBlogDraftEditDisabledNote(options: {
  initialLoad: boolean;
  queue: 'pending' | 'expired';
  cmsConfigured: boolean;
  editEnabled: boolean | null;
}): boolean {
  if (options.initialLoad) return false;
  if (options.queue !== 'pending') return false;
  if (!options.cmsConfigured) return false;
  return options.editEnabled === false;
}

export function nextEditEnabledState(
  previous: boolean | null,
  editEnabledFromApi: boolean | undefined,
): boolean | null {
  const next = editEnabledFromApi === true;
  return previous === next ? previous : next;
}

/** draftId → timestamp (ms) when save-success message should hide. */
export function markDraftSaveSuccessVisible(
  map: Record<string, number>,
  draftId: string,
  nowMs = Date.now(),
): Record<string, number> {
  return { ...map, [draftId]: nowMs + BLOG_DRAFT_SAVE_SUCCESS_MIN_MS };
}

export function clearDraftSaveSuccess(
  map: Record<string, number>,
  draftId: string,
): Record<string, number> {
  if (!(draftId in map)) return map;
  const next = { ...map };
  delete next[draftId];
  return next;
}

export function isDraftSaveSuccessVisible(
  map: Record<string, number>,
  draftId: string,
  nowMs = Date.now(),
): boolean {
  const until = map[draftId];
  return typeof until === 'number' && until > nowMs;
}
