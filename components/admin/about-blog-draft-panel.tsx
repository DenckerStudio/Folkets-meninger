'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { CharacterCountTextarea } from '@/components/ui/character-count-textarea';
import { Input } from '@/components/ui/input';
import {
  ABOUT_BLOG_TITLE_INPUT_ID,
  focusAboutBlogTitleField,
  formatAboutBlogSuggestionDraftFailure,
  type AboutBlogDraftFormFields,
} from '@/lib/admin/about-blog-panels';
import { adminVurderHref } from '@/lib/admin/vurder-tabs';
import { formatBlogDate } from '@/lib/blog/format';
import { cn } from '@/lib/utils';

type AboutDraft = {
  id: string;
  slug: string;
  adminUrl: string | null;
  cmsStatus: string;
  updatedAt: string | null;
};

type DraftJson = {
  id?: string;
  slug?: string;
  admin_url?: string;
  cms_status?: string;
  updated_at?: string | null;
};

export type AppliedAboutSuggestion = {
  token: number;
  key: string;
  title: string;
  angle: string;
};

export type AboutBlogDraftPanelProps = {
  titleMax: number;
  titleMin: number;
  angleMax: number;
  publicCategoryHref: string;
  appliedSuggestion?: AppliedAboutSuggestion | null;
  onFormFieldsChange?: (fields: AboutBlogDraftFormFields) => void;
  onDraftCreated?: (suggestionKey: string) => void;
  onSuggestionDraftFailed?: (suggestionKey: string) => void;
  onUserEditedForm?: () => void;
};

function toDraft(row: DraftJson): AboutDraft | null {
  if (!row.id || !row.slug) return null;
  const adminUrl = row.admin_url && /^https?:\/\//.test(row.admin_url) ? row.admin_url : null;
  return {
    id: row.id,
    slug: row.slug,
    adminUrl,
    cmsStatus: row.cms_status ?? 'unknown',
    updatedAt: row.updated_at ?? null,
  };
}

function statusLabel(cmsStatus: string): string {
  if (cmsStatus === 'published') return 'Publisert';
  if (cmsStatus === 'draft') return 'Utkast';
  return 'Ukjent status';
}

export function AboutBlogDraftPanel({
  titleMax,
  titleMin,
  angleMax,
  publicCategoryHref,
  appliedSuggestion = null,
  onFormFieldsChange,
  onDraftCreated,
  onSuggestionDraftFailed,
  onUserEditedForm,
}: AboutBlogDraftPanelProps) {
  const [title, setTitle] = useState('');
  const [angle, setAngle] = useState('');
  const [drafts, setDrafts] = useState<AboutDraft[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [cmsLookupFailed, setCmsLookupFailed] = useState(false);
  const [llmConfigured, setLlmConfigured] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<AboutDraft | null>(null);
  const inFlightRef = useRef(false);
  // Reused until the request succeeds or the form changes, so a retry cannot create a duplicate.
  const requestIdRef = useRef<string | null>(null);
  const suggestionKeyRef = useRef<string | null>(null);
  const appliedTokenRef = useRef<number | null>(null);

  const refreshDrafts = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/blog/about-draft', { cache: 'no-store' });
      if (!res.ok) {
        setCmsLookupFailed(true);
        return;
      }
      const body = (await res.json()) as {
        drafts?: DraftJson[];
        cms_lookup_failed?: boolean;
        llm_configured?: boolean;
      };
      setCmsLookupFailed(body.cms_lookup_failed === true);
      setLlmConfigured(body.llm_configured !== false);
      setDrafts(
        (body.drafts ?? []).map(toDraft).filter((row): row is AboutDraft => row !== null),
      );
    } catch {
      setCmsLookupFailed(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  useEffect(() => {
    onFormFieldsChange?.({ title, angle });
  }, [title, angle, onFormFieldsChange]);

  useEffect(() => {
    if (!appliedSuggestion || appliedSuggestion.token === appliedTokenRef.current) return;
    appliedTokenRef.current = appliedSuggestion.token;
    setTitle(appliedSuggestion.title);
    setAngle(appliedSuggestion.angle);
    suggestionKeyRef.current = appliedSuggestion.key;
    requestIdRef.current = null;
    setError('');
    setCreated(null);
    const frame = requestAnimationFrame(() => focusAboutBlogTitleField(document));
    return () => cancelAnimationFrame(frame);
  }, [appliedSuggestion]);

  const trimmedTitle = title.trim();
  const titleTooShort = trimmedTitle.length > 0 && trimmedTitle.length < titleMin;
  const canSubmit = trimmedTitle.length >= titleMin && llmConfigured && !pending;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || inFlightRef.current) return;
    inFlightRef.current = true;
    requestIdRef.current ??= crypto.randomUUID();
    const activeSuggestionKey = suggestionKeyRef.current;
    const fromSuggestion = Boolean(activeSuggestionKey);
    setError('');
    setCreated(null);
    setPending(true);
    try {
      const res = await fetch('/api/admin/blog/about-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          angle: angle.trim() || undefined,
          request_id: requestIdRef.current,
          suggestion_key: suggestionKeyRef.current ?? undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as DraftJson & { message?: string };
      const draft = res.ok ? toDraft(body) : null;
      if (!draft) {
        if (fromSuggestion && activeSuggestionKey) {
          onSuggestionDraftFailed?.(activeSuggestionKey);
        }
        setError(
          fromSuggestion
            ? formatAboutBlogSuggestionDraftFailure(body.message)
            : typeof body.message === 'string' && body.message.trim()
              ? body.message
              : 'Kunne ikke lage utkast. Prøv igjen.',
        );
        return;
      }
      if (activeSuggestionKey) {
        onDraftCreated?.(activeSuggestionKey);
      }
      requestIdRef.current = null;
      suggestionKeyRef.current = null;
      setCreated(draft);
      setTitle('');
      setAngle('');
      await refreshDrafts();
    } catch {
      if (activeSuggestionKey) {
        onSuggestionDraftFailed?.(activeSuggestionKey);
      }
      setError(
        activeSuggestionKey
          ? formatAboutBlogSuggestionDraftFailure(null)
          : 'Kunne ikke lage utkast. Prøv igjen.',
      );
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section
        className="space-y-4 rounded-xl border border-border bg-card p-4"
        aria-labelledby="about-blog-draft-heading"
      >
        <div className="space-y-1">
          <h3 id="about-blog-draft-heading" className="text-base font-semibold text-foreground">
            Nytt utkast
          </h3>
          <p className="text-sm text-muted-foreground">
            Utkastet lagres i bloggen under temaet «Om Folkets Meninger» og bygger på teksten om
            tjenesten fra forsiden. Ingenting publiseres automatisk. Redaktør godkjenner og
            publiserer i blogg-admin.
          </p>
        </div>

        {!llmConfigured ? (
          <p
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            role="alert"
          >
            Tekstgenerering er ikke satt opp på app-serveren, så det kan ikke lages utkast her ennå.
          </p>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="about-blog-title" className="text-sm font-medium text-foreground">
              Tittel
            </label>
            <Input
              id={ABOUT_BLOG_TITLE_INPUT_ID}
              value={title}
              onChange={(event) => {
                onUserEditedForm?.();
                setTitle(event.target.value);
                requestIdRef.current = null;
              }}
              maxLength={titleMax}
              required
              disabled={pending}
              placeholder="Hvorfor vi lagde Folkets Meninger"
              className="min-h-11"
              aria-describedby={titleTooShort ? 'about-blog-title-hint' : undefined}
            />
            {titleTooShort ? (
              <p id="about-blog-title-hint" className="text-xs text-muted-foreground">
                Tittelen må ha minst {titleMin} tegn.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="about-blog-angle" className="text-sm font-medium text-foreground">
              Vinkling <span className="font-normal text-muted-foreground">(valgfritt)</span>
            </label>
            <CharacterCountTextarea
              id="about-blog-angle"
              value={angle}
              onChange={(value) => {
                onUserEditedForm?.();
                setAngle(value);
                requestIdRef.current = null;
              }}
              maxLength={angleMax}
              rows={4}
              disabled={pending}
              placeholder="Hva skal innlegget legge vekt på?"
              aria-describedby="about-blog-angle-hint"
            />
            <p id="about-blog-angle-hint" className="text-xs text-muted-foreground">
              Teksten holder seg til det som står om tjenesten på forsiden. Nye tall og funksjoner
              legger du inn selv i blogg-admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(buttonVariants({ variant: 'default' }), 'min-h-11 gap-1.5 px-4')}
            >
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {pending ? 'Skriver utkast…' : 'Lag utkast'}
            </button>
            {pending ? (
              <p className="text-sm text-muted-foreground" role="status">
                Dette kan ta opptil to minutter. La siden stå åpen.
              </p>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {created ? (
          <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
            role="status"
          >
            <p className="min-w-0 flex-1 text-sm text-foreground">
              Utkastet «{created.slug}» er lagret og venter på vurdering.
            </p>
            {created.adminUrl ? (
              <Link
                href={created.adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 gap-1.5 px-3 w-full sm:w-auto')}
              >
                Åpne utkast
                <ExternalLink className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
            <Link
              href={adminVurderHref('blogg')}
              className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 px-3 w-full sm:w-auto')}
            >
              Gå til vurdering
            </Link>
          </div>
        ) : null}
      </section>

      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        aria-labelledby="about-blog-drafts-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 id="about-blog-drafts-heading" className="text-base font-semibold text-foreground">
              Utkast laget her
            </h3>
            <p className="text-sm text-muted-foreground">
              De siste innleggene som er laget fra denne siden, både utkast og publiserte.
            </p>
          </div>
          <Link
            href={publicCategoryHref}
            className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Se temaet på bloggen
          </Link>
        </div>

        {cmsLookupFailed ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
            role="alert"
          >
            <p className="min-w-0 flex-1">Kunne ikke hente utkast fra bloggen akkurat nå.</p>
            <button
              type="button"
              disabled={listLoading}
              onClick={() => void refreshDrafts()}
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'min-h-11 shrink-0 border-amber-600/30 bg-background px-3',
              )}
            >
              Prøv igjen
            </button>
          </div>
        ) : null}

        {listLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Laster utkast" role="status">
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
            <div className="h-11 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : null}

        {!listLoading && !cmsLookupFailed && drafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen utkast er laget her ennå.</p>
        ) : null}

        {!listLoading && drafts.length > 0 ? (
          <ul className="divide-y divide-border">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-col gap-y-0.5 py-2 sm:flex-row sm:items-center sm:gap-x-3"
              >
                {draft.adminUrl ? (
                  <Link
                    href={draft.adminUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 min-w-0 items-center gap-1.5 text-sm font-medium text-brand [overflow-wrap:anywhere] hover:underline sm:flex-1"
                  >
                    {draft.slug}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </Link>
                ) : (
                  <span className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere] sm:flex-1">
                    {draft.slug}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {statusLabel(draft.cmsStatus)}
                  {draft.updatedAt ? ` · ${formatBlogDate(draft.updatedAt)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
