export const ABOUT_BLOG_TITLE_INPUT_ID = 'about-blog-title';

export const ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM =
  'Forslaget overskriver tittel og vinkling du har skrevet. Vil du fortsette?';

export type AboutBlogDraftFormFields = {
  title: string;
  angle: string;
};

export function aboutBlogDraftFormIsDirty(fields: AboutBlogDraftFormFields): boolean {
  return fields.title.trim().length > 0 || fields.angle.trim().length > 0;
}

export function shouldShowAboutSuggestionsEmptyState(args: {
  loading: boolean;
  hasError: boolean;
  tableMessage: boolean;
  suggestionCount: number;
}): boolean {
  return !args.loading && !args.hasError && !args.tableMessage && args.suggestionCount === 0;
}

type FocusableDocument = {
  getElementById: (id: string) => { focus?: (options?: { preventScroll?: boolean }) => void; scrollIntoView?: (options?: ScrollIntoViewOptions) => void } | null;
};

export function focusAboutBlogTitleField(doc: FocusableDocument): void {
  const el = doc.getElementById(ABOUT_BLOG_TITLE_INPUT_ID);
  if (!el || typeof el.focus !== 'function') return;
  el.focus({ preventScroll: false });
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}