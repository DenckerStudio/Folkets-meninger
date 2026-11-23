export const ABOUT_BLOG_TITLE_INPUT_ID = 'about-blog-title';

export const ABOUT_BLOG_SUGGESTION_OVERWRITE_CONFIRM =
  'Forslaget overskriver tittelen og vinklingen i skjemaet. Vil du fortsette?';

export const ABOUT_BLOG_SUGGESTION_PICKED_MESSAGE =
  'Tittel og vinkling er fylt inn i skjemaet under.';

export const ABOUT_BLOG_SUGGESTION_CONSUMED_MESSAGE = 'Utkast lagret. Forslaget er brukt.';

export type AboutBlogDraftFormFields = {
  title: string;
  angle: string;
};

export function aboutBlogDraftFormIsDirty(fields: AboutBlogDraftFormFields): boolean {
  return fields.title.trim().length > 0 || fields.angle.trim().length > 0;
}

export function aboutBlogDraftFormOverwritesBaseline(
  fields: AboutBlogDraftFormFields,
  baseline: AboutBlogDraftFormFields | null,
): boolean {
  if (!baseline) return aboutBlogDraftFormIsDirty(fields);
  return (
    fields.title.trim() !== baseline.title.trim() || fields.angle.trim() !== baseline.angle.trim()
  );
}

export function formatAboutBlogSuggestionDraftFailure(message?: string | null): string {
  const detail = typeof message === 'string' && message.trim() ? message.trim() : null;
  if (!detail) return 'Utkastet feilet. Forslaget kan brukes på nytt.';
  return `Utkastet feilet: ${detail}. Forslaget kan brukes på nytt.`;
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