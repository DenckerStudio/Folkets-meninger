'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { BlogMarkdown } from '@/components/blog/blog-markdown';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import type { BlogDraftEditSaved, BlogDraftSourceEditRow } from '@/lib/admin/blog-draft-edit';
import { editRowsFromCmsSources } from '@/lib/admin/blog-draft-source-edit';
import {
  firstFieldErrorKey,
  mapApiFieldErrors,
  validateBlogDraftEditContent,
  type BlogDraftEditFieldErrors,
  type BlogDraftEditFieldKey,
} from '@/lib/admin/blog-draft-edit-fields';
import type { BlogDraftEditServerSnapshot } from '@/lib/admin/blog-draft-edit-panel-state';
import { BLOG_EXCERPT_MAX, BLOG_TITLE_MAX } from '@/lib/blog/text-limits';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { cn } from '@/lib/utils';

export type BlogDraftEditPanelDraft = BlogDraftEditServerSnapshot;

type BlogDraftEditPanelProps = {
  draft: BlogDraftEditPanelDraft;
  onCancel: () => void;
  onSaved: (saved: BlogDraftEditSaved) => void;
  onUserEdit: () => void;
};

type BodyPane = 'skriv' | 'forhandsvis';

type DirtyFields = {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
};

export function BlogDraftEditPanel({
  draft,
  onCancel,
  onSaved,
  onUserEdit,
}: BlogDraftEditPanelProps) {
  const formId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const excerptRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const continueEditRef = useRef<HTMLButtonElement>(null);
  const [dirtyFields, setDirtyFields] = useState<DirtyFields | null>(null);
  const [sourceRows, setSourceRows] = useState<BlogDraftSourceEditRow[]>(() =>
    editRowsFromCmsSources(draft.sources),
  );
  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<BlogDraftEditFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [bodyPane, setBodyPane] = useState<BodyPane>('skriv');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const title = dirtyFields?.title ?? draft.title;
  const excerpt = dirtyFields?.excerpt ?? draft.excerpt;
  const bodyMarkdown = dirtyFields?.bodyMarkdown ?? draft.bodyMarkdown;
  const isDirty = dirtyFields !== null || sourcesDirty;

  const titleErrorId = `${formId}-title-error`;
  const titleCountId = `${formId}-title-count`;
  const excerptErrorId = `${formId}-excerpt-error`;
  const bodyErrorId = `${formId}-body-error`;
  const bodyCountId = `${formId}-body-count`;

  const currentFields = (): DirtyFields => ({
    title,
    excerpt,
    bodyMarkdown,
  });

  const markEdited = (next: DirtyFields) => {
    onUserEdit();
    setDirtyFields(next);
  };

  const focusField = (key: BlogDraftEditFieldKey) => {
    const target =
      key === 'title' ? titleRef.current : key === 'excerpt' ? excerptRef.current : bodyRef.current;
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const save = () => {
    setFormError('');
    const validation = validateBlogDraftEditContent({ title, excerpt, bodyMarkdown });
    if (!validation.ok) {
      setFormError('');
      setFieldErrors(validation.fields);
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
            sources: sourceRows,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          fields?: Record<string, unknown>;
          draft?: BlogDraftEditSaved;
        };
        if (!res.ok) {
          const apiFields = mapApiFieldErrors(data.fields);
          if (Object.keys(apiFields).length > 0) {
            setFormError('');
            setFieldErrors(apiFields);
            const firstKey = firstFieldErrorKey(apiFields);
            if (firstKey) {
              if (firstKey === 'bodyMarkdown') setBodyPane('skriv');
              focusField(firstKey);
            }
            return;
          }
          setFieldErrors({});
          const message =
            typeof data.error === 'string' && data.error.trim()
              ? data.error.endsWith('.')
                ? data.error
                : `${data.error}.`
              : 'Kunne ikke lagre endringer.';
          setFormError(message);
          return;
        }
        setDirtyFields(null);
        setSourcesDirty(false);
        if (data.draft && typeof data.draft.id === 'string') {
          onSaved(data.draft);
          return;
        }
        onSaved({
          id: draft.id,
          title: title.trim(),
          excerpt: excerpt.trim(),
          bodyMarkdown,
          sources: sourceRows.map((row) => ({
            label: `${row.title} (${row.publisher})`,
            url: row.url,
          })),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        setFormError('Kunne ikke lagre endringer.');
      }
    });
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onCancel();
  };

  const closeDiscardConfirm = (focusCancel: boolean) => {
    setDiscardConfirmOpen(false);
    if (focusCancel) {
      requestAnimationFrame(() => {
        cancelButtonRef.current?.focus();
      });
    }
  };

  useEffect(() => {
    if (!discardConfirmOpen) return;
    continueEditRef.current?.focus();
  }, [discardConfirmOpen]);

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
              onChange={(event) => {
                markEdited({ ...currentFields(), title: event.target.value });
              }}
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
            <p id={titleErrorId} className="text-xs font-medium text-destructive">
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
            onChange={(value) => {
              markEdited({ ...currentFields(), excerpt: value });
            }}
            placeholder="Kort sammendrag som vises i lister og delinger."
          />
          {fieldErrors.excerpt ? (
            <p id={excerptErrorId} className="text-xs font-medium text-destructive">
              {fieldErrors.excerpt}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">Brødtekst</span>
            <div
              className="inline-flex rounded-lg border border-border bg-card p-0.5 lg:hidden"
              role="group"
              aria-label="Vis brødtekst som redigering eller forhåndsvisning"
            >
              <button
                type="button"
                className={cn(
                  'min-h-11 rounded-md px-3 text-xs font-medium',
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
                  'min-h-11 rounded-md px-3 text-xs font-medium',
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
                  onChange={(event) => {
                    markEdited({ ...currentFields(), bodyMarkdown: event.target.value });
                  }}
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
                <p id={bodyErrorId} className="mt-1 text-xs font-medium text-destructive">
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Kilder brukt i utkastet</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onUserEdit();
                setSourcesDirty(true);
                setSourceRows((rows) => [
                  ...rows,
                  { title: '', publisher: '', url: '' },
                ]);
              }}
              className={cn(
                'inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50',
                VURDER_FOCUS_RING,
              )}
            >
              Legg til kilde
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Justér kildelisten før godkjenning. Reddit og blokkerte domener kan ikke lagres.
          </p>
          {sourceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen kilder er knyttet til utkastet ennå.</p>
          ) : (
            <ul className="space-y-3">
              {sourceRows.map((row, index) => (
                <li
                  key={`${row.url || 'new'}-${index}`}
                  className="rounded-xl border border-border bg-card p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block space-y-1 text-xs font-medium text-foreground">
                      Tittel
                      <input
                        type="text"
                        disabled={pending}
                        value={row.title}
                        onChange={(event) => {
                          onUserEdit();
                          setSourcesDirty(true);
                          setSourceRows((rows) =>
                            rows.map((item, i) =>
                              i === index ? { ...item, title: event.target.value } : item,
                            ),
                          );
                        }}
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-medium text-foreground">
                      Utgiver / domene
                      <input
                        type="text"
                        disabled={pending}
                        value={row.publisher}
                        onChange={(event) => {
                          onUserEdit();
                          setSourcesDirty(true);
                          setSourceRows((rows) =>
                            rows.map((item, i) =>
                              i === index ? { ...item, publisher: event.target.value } : item,
                            ),
                          );
                        }}
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-medium text-foreground sm:col-span-2">
                      URL
                      <input
                        type="url"
                        disabled={pending}
                        value={row.url}
                        onChange={(event) => {
                          onUserEdit();
                          setSourcesDirty(true);
                          setSourceRows((rows) =>
                            rows.map((item, i) =>
                              i === index ? { ...item, url: event.target.value } : item,
                            ),
                          );
                        }}
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <label className="block space-y-1 text-xs font-medium text-foreground">
                      Dato (valgfritt)
                      <input
                        type="text"
                        disabled={pending}
                        value={row.publishedAt ?? ''}
                        placeholder="2026-01-15"
                        onChange={(event) => {
                          onUserEdit();
                          setSourcesDirty(true);
                          setSourceRows((rows) =>
                            rows.map((item, i) =>
                              i === index ? { ...item, publishedAt: event.target.value } : item,
                            ),
                          );
                        }}
                        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      onUserEdit();
                      setSourcesDirty(true);
                      setSourceRows((rows) => rows.filter((_, i) => i !== index));
                    }}
                    className={cn(
                      'mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50',
                      VURDER_FOCUS_RING,
                    )}
                  >
                    Fjern kilde
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {discardConfirmOpen ? (
        <div
          className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
          role="region"
          aria-label="Bekreft forkasting"
        >
          <p className="text-sm font-medium text-foreground">Forkaste endringene?</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDiscardConfirmOpen(false);
                onCancel();
              }}
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto',
                VURDER_FOCUS_RING,
              )}
            >
              Forkast
            </button>
            <button
              ref={continueEditRef}
              type="button"
              disabled={pending}
              onClick={() => closeDiscardConfirm(true)}
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 sm:w-auto',
                VURDER_FOCUS_RING,
              )}
            >
              Fortsett å redigere
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={cn(
              'inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto',
              VURDER_FOCUS_RING,
            )}
          >
            {pending ? 'Lagrer …' : 'Lagre utkast'}
          </button>
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={pending}
            onClick={handleCancelClick}
            className={cn(
              'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 sm:w-auto',
              VURDER_FOCUS_RING,
            )}
          >
            Avbryt
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {isDirty ? 'Ulagrede endringer' : ''}
      </p>
    </section>
  );
}
