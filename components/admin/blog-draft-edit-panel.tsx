'use client';

import { useId, useRef, useState, useTransition } from 'react';
import { BlogMarkdown } from '@/components/blog/blog-markdown';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import {
  firstFieldErrorKey,
  mapApiFieldErrors,
  validateBlogDraftEditContent,
  type BlogDraftEditFieldErrors,
  type BlogDraftEditFieldKey,
} from '@/lib/admin/blog-draft-edit-fields';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';
import { cn } from '@/lib/utils';

export type BlogDraftEditPanelDraft = {
  id: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
};

type BlogDraftEditPanelProps = {
  draft: BlogDraftEditPanelDraft;
  onCancel: () => void;
  onSaved: () => void;
};

type BodyPane = 'skriv' | 'forhandsvis';

const SAVE_SUCCESS_MESSAGE = 'Utkastet er lagret.';

export function BlogDraftEditPanel({ draft, onCancel, onSaved }: BlogDraftEditPanelProps) {
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(draft.title);
  const [excerpt, setExcerpt] = useState(draft.excerpt);
  const [bodyMarkdown, setBodyMarkdown] = useState(draft.bodyMarkdown);
  const [fieldErrors, setFieldErrors] = useState<BlogDraftEditFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [bodyPane, setBodyPane] = useState<BodyPane>('skriv');
  const [pending, startTransition] = useTransition();

  const titleErrorId = `${formId}-title-error`;
  const titleCountId = `${formId}-title-count`;
  const excerptErrorId = `${formId}-excerpt-error`;
  const bodyErrorId = `${formId}-body-error`;
  const bodyCountId = `${formId}-body-count`;

  const focusField = (key: BlogDraftEditFieldKey) => {
    const target =
      key === 'title' ? titleRef.current : key === 'excerpt' ? excerptRef.current : bodyRef.current;
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const save = () => {
    setFormError('');
    setSuccess('');
    const validation = validateBlogDraftEditContent({ title, excerpt, bodyMarkdown });
    if (!validation.ok) {
      setFieldErrors(validation.fields);
      setFormError(validation.error);
      const firstKey = firstFieldErrorKey(validation.fields);
      if (firstKey) {
        if (firstKey === 'bodyMarkdown') setBodyPane('skriv');
        focusField(firstKey);
      }
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/blog-drafts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draft.id,
            action: 'edit',
            title: title.trim(),
            excerpt: excerpt.trim(),
            bodyMarkdown,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          fields?: Record<string, unknown>;
        };
        if (!res.ok) {
          const apiFields = mapApiFieldErrors(data.fields);
          if (Object.keys(apiFields).length > 0) {
            setFieldErrors(apiFields);
            const firstKey = firstFieldErrorKey(apiFields);
            if (firstKey) {
              if (firstKey === 'bodyMarkdown') setBodyPane('skriv');
              focusField(firstKey);
            }
          }
          const message =
            typeof data.error === 'string' && data.error.trim()
              ? data.error.endsWith('.')
                ? data.error
                : `${data.error}.`
              : 'Kunne ikke lagre endringer.';
          setFormError(message);
          return;
        }
        setSuccess(SAVE_SUCCESS_MESSAGE);
        onSaved();
      } catch {
        setFormError('Kunne ikke lagre endringer.');
      }
    });
  };

  const titleTrimmedLength = title.trim().length;
  const bodyTrimmedLength = bodyMarkdown.trim().length;

  return (
    <section
      className="mt-4 rounded-xl border border-border bg-muted/20 p-4"
      aria-labelledby={`${formId}-heading`}
    >
      <h3 id={`${formId}-heading`} className="text-sm font-semibold text-foreground">
        Rediger her
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Juster tittel, ingress og brødtekst før publisering. Endringer lagres som utkast i bloggen.
      </p>
      {formError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      {success ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-title`} className="text-sm font-medium text-foreground">
            Tittel
          </label>
          <div className="relative">
            <input
              ref={titleRef}
              id={`${formId}-title`}
              type="text"
              value={title}
              maxLength={BLOG_TITLE_MAX}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={
                [fieldErrors.title ? titleErrorId : null, titleCountId].filter(Boolean).join(' ') ||
                undefined
              }
              onChange={(event) => setTitle(event.target.value)}
              className={cn(
                'w-full rounded-xl border border-border bg-card px-3 py-2.5 pr-16 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30',
                fieldErrors.title && 'border-destructive',
              )}
            />
            <span
              id={titleCountId}
              className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums text-muted-foreground"
            >
              {titleTrimmedLength}/{BLOG_TITLE_MAX}
            </span>
          </div>
          {fieldErrors.title ? (
            <p id={titleErrorId} className="text-xs font-medium text-destructive" role="alert">
              {fieldErrors.title}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-excerpt`} className="text-sm font-medium text-foreground">
            Ingress
          </label>
          <CharacterCountTextarea
            id={`${formId}-excerpt`}
            value={excerpt}
            maxLength={BLOG_EXCERPT_MAX}
            rows={3}
            disabled={pending}
            aria-invalid={Boolean(fieldErrors.excerpt)}
            aria-describedby={fieldErrors.excerpt ? excerptErrorId : undefined}
            onChange={setExcerpt}
            placeholder="Kort sammendrag som vises i lister og delinger."
          />
          {fieldErrors.excerpt ? (
            <p id={excerptErrorId} className="text-xs font-medium text-destructive" role="alert">
              {fieldErrors.excerpt}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Brødtekst</span>
            <div
              className="inline-flex rounded-lg border border-border bg-card p-0.5"
              role="group"
              aria-label="Vis brødtekst som redigering eller forhåndsvisning"
            >
              <button
                type="button"
                className={cn(
                  'min-h-9 rounded-md px-3 text-xs font-medium',
                  bodyPane === 'skriv'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={bodyPane === 'skriv'}
                onClick={() => setBodyPane('skriv')}
              >
                Rediger
              </button>
              <button
                type="button"
                className={cn(
                  'min-h-9 rounded-md px-3 text-xs font-medium',
                  bodyPane === 'forhandsvis'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={bodyPane === 'forhandsvis'}
                onClick={() => setBodyPane('forhandsvis')}
              >
                Forhåndsvis
              </button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className={cn(bodyPane === 'forhandsvis' ? 'hidden lg:block' : undefined)}>
              <div className="relative">
                <textarea
                  ref={bodyRef}
                  id={`${formId}-body`}
                  value={bodyMarkdown}
                  rows={12}
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.bodyMarkdown)}
                  aria-describedby={
                    [fieldErrors.bodyMarkdown ? bodyErrorId : null, bodyCountId]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  onChange={(event) => setBodyMarkdown(event.target.value)}
                  placeholder="Skriv innlegget i Markdown."
                  className={cn(
                    'min-h-[12rem] w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 pb-7 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30',
                    fieldErrors.bodyMarkdown && 'border-destructive',
                  )}
                />
                <span
                  id={bodyCountId}
                  className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular-nums text-muted-foreground"
                >
                  {bodyTrimmedLength} tegn
                </span>
              </div>
              {fieldErrors.bodyMarkdown ? (
                <p id={bodyErrorId} className="mt-1 text-xs font-medium text-destructive" role="alert">
                  {fieldErrors.bodyMarkdown}
                </p>
              ) : null}
            </div>
            <div
              className={cn(
                'min-h-[12rem] rounded-xl border border-border bg-card p-3',
                bodyPane === 'skriv' ? 'hidden lg:block' : undefined,
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">Forhåndsvisning</p>
              <div className="mt-2 max-w-full overflow-x-auto">
                {bodyMarkdown.trim() ? (
                  <BlogMarkdown markdown={bodyMarkdown} />
                ) : (
                  <p className="text-sm text-muted-foreground">Ingen brødtekst å vise ennå.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Lagrer …' : 'Lagre utkast'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          Avbryt
        </button>
      </div>
    </section>
  );
}
