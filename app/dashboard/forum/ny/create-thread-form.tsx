'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AtSign,
  FileText,
  Gavel,
  Layers,
  Lightbulb,
  Loader2,
  LogIn,
  Shield,
} from 'lucide-react';
import { FORUM_LIMITS } from '@/lib/forum/validation';
import {
  contextItemKey,
  insertContextIntoBody,
  sakContextItem,
  type ForumContextItem,
} from '@/lib/forum/context';
import { routes } from '@/lib/routes';
import {
  clearForumThreadDraft,
  loadForumThreadDraft,
  saveForumThreadDraft,
  type ForumThreadDraft,
} from '@/lib/forum/thread-draft-storage';
import ContextPicker, { ContextChip } from '@/components/forum/context-picker';
import { ForumBodyComposer } from '@/components/forum/forum-body-composer';
import { SakQuickActionLinks } from '@/components/forum/sak-quick-action-modal';

type CreateThreadFormProps = {
  sakId?: string | null;
  sakTitle?: string | null;
  suggestedIssues?: { id: string; title: string }[];
};

const inputClass =
  'w-full rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm ring-1 ring-gray-200 transition-shadow placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

export default function CreateThreadForm({
  sakId: initialSakId,
  sakTitle: initialSakTitle,
  suggestedIssues = [],
}: CreateThreadFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [primarySakId, setPrimarySakId] = useState<string | null>(initialSakId || null);
  const [primarySakTitle, setPrimarySakTitle] = useState<string | null>(initialSakTitle || null);
  const [linkedItems, setLinkedItems] = useState<ForumContextItem[]>([]);
  const [relatedItems, setRelatedItems] = useState<ForumContextItem[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(true);
  const [pendingDraft, setPendingDraft] = useState<ForumThreadDraft | null>(null);
  const [showDraftChoice, setShowDraftChoice] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const draftHydrated = useRef(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    fetch('/api/user/profile')
      .then((res) => res.json())
      .then((data) => {
        setHasIdentity(!!data.has_forum_identity);
        setDisplayName(data.display_name || null);
      })
      .catch(() => {});
  }, [user]);

  const linkedKeys = useMemo(
    () => new Set(linkedItems.map(contextItemKey)),
    [linkedItems]
  );

  const applyDraft = useCallback(
    (draft: ForumThreadDraft) => {
      setTitle(draft.title);
      setBody(draft.body);
      setLinkedItems(draft.linkedItems);
      if (!initialSakId) {
        setPrimarySakId(draft.primarySakId);
        setPrimarySakTitle(draft.primarySakTitle);
      }
    },
    [initialSakId]
  );

  const resetForm = useCallback(() => {
    setTitle('');
    setBody('');
    setLinkedItems([]);
    if (!initialSakId) {
      setPrimarySakId(null);
      setPrimarySakTitle(null);
    }
  }, [initialSakId]);

  useEffect(() => {
    const draft = loadForumThreadDraft();
    if (draft) {
      setPendingDraft(draft);
      setShowDraftChoice(true);
    } else {
      draftHydrated.current = true;
    }
  }, []);

  const handleContinueDraft = useCallback(() => {
    if (pendingDraft) applyDraft(pendingDraft);
    setPendingDraft(null);
    setShowDraftChoice(false);
    draftHydrated.current = true;
  }, [applyDraft, pendingDraft]);

  const handleStartFresh = useCallback(() => {
    clearForumThreadDraft();
    resetForm();
    setPendingDraft(null);
    setShowDraftChoice(false);
    draftHydrated.current = true;
  }, [resetForm]);

  const persistDraft = useCallback(() => {
    if (!draftHydrated.current) return;
    saveForumThreadDraft({
      title,
      body,
      primarySakId,
      primarySakTitle,
      linkedItems,
    });
  }, [title, body, primarySakId, primarySakTitle, linkedItems]);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const t = setTimeout(persistDraft, 500);
    return () => clearTimeout(t);
  }, [persistDraft]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') persistDraft();
    };
    const onUnload = () => persistDraft();

    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      persistDraft();
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persistDraft]);

  useEffect(() => {
    if (!primarySakId) {
      setRelatedItems([]);
      return;
    }

    let cancelled = false;
    setLoadingRelated(true);

    fetch(`/api/forum/sak-resources/${primarySakId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRelatedItems(data.related || []);
        if (data.sak?.title) {
          setPrimarySakTitle(data.sak.title);
        }
      })
      .catch(() => {
        if (!cancelled) setRelatedItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRelated(false);
      });

    return () => {
      cancelled = true;
    };
  }, [primarySakId]);

  const appendContext = useCallback((item: ForumContextItem, asPrimarySak = false) => {
    if (asPrimarySak && item.kind === 'sak') {
      setPrimarySakId(item.id);
      setPrimarySakTitle(item.title);
    }

    setLinkedItems((prev) => {
      const key = contextItemKey(item);
      if (prev.some((p) => contextItemKey(p) === key)) return prev;
      return [...prev, item];
    });

    setBody((prev) => insertContextIntoBody(prev, item));
    bodyRef.current?.focus();
  }, []);

  const handleSelect = useCallback(
    (item: ForumContextItem) => {
      if (item.kind === 'sak' && !primarySakId) {
        appendContext(item, true);
        return;
      }
      appendContext(item, false);
    },
    [appendContext, primarySakId]
  );

  const insertMention = () => {
    const el = bodyRef.current;
    const snippet = '\n@';
    if (!el) {
      setBody((prev) => `${prev}${prev ? '\n' : ''}@`);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${body.slice(0, start)}${snippet}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || isSubmitting) return;
    if (!hasIdentity) {
      router.push(`${routes.completeProfile}?next=${encodeURIComponent(routes.forumNew(primarySakId || undefined))}`);
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/forum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_thread',
          title: title.trim(),
          body: body.trim(),
          stortinget_issue_id: primarySakId,
          context_items: linkedItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kunne ikke opprette tråd');
        return;
      }

      clearForumThreadDraft();
      router.push(routes.forumTopic(data.threadId));
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickSuggestions = suggestedIssues.filter((s) => s.id !== primarySakId).slice(0, 4);

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
        <Link
          href={routes.login}
          className="inline-flex items-center font-medium text-indigo-600 hover:text-indigo-500"
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          Logg inn for å starte en diskusjon
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}

        {showDraftChoice && (
          <div
            className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-4 sm:px-5"
            role="dialog"
            aria-labelledby="draft-choice-heading"
          >
            <p id="draft-choice-heading" className="text-sm font-semibold text-gray-900">
              Du har et lagret utkast
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Vil du fortsette der du slapp, eller starte en ny diskusjon?
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleContinueDraft}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Fortsett med utkast
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
              >
                Start på nytt
              </button>
            </div>
          </div>
        )}

        {primarySakId && primarySakTitle && (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Hovedsak</p>
            <p className="mt-1 font-semibold text-indigo-950">{primarySakTitle}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <SakQuickActionLinks sakId={primarySakId} sakTitle={primarySakTitle} />
            </div>
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200/80 sm:p-8">
          <div className="space-y-5">
            <div>
              <label htmlFor="thread-title" className="mb-1.5 block text-sm font-medium text-gray-800">
                Tittel
              </label>
              <input
                id="thread-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={FORUM_LIMITS.titleMax}
                className={inputClass}
                placeholder="Hva vil du diskutere?"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {title.length}/{FORUM_LIMITS.titleMax} tegn (min. {FORUM_LIMITS.titleMin})
              </p>
            </div>

            <div>
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-800">
                <Layers className="h-4 w-4 text-indigo-600" aria-hidden />
                Koble til sak, høring eller politiker
              </p>
              <ContextPicker
                onSelect={handleSelect}
                selectedKeys={linkedKeys}
                placeholder="Søk og velg…"
              />
              {linkedItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {linkedItems.map((item) => (
                    <ContextChip
                      key={contextItemKey(item)}
                      item={item}
                      isPrimary={item.kind === 'sak' && item.id === primarySakId}
                      onPrimary={
                        item.kind === 'sak'
                          ? () => {
                              setPrimarySakId(item.id);
                              setPrimarySakTitle(item.title);
                            }
                          : undefined
                      }
                      onRemove={() =>
                        setLinkedItems((prev) =>
                          prev.filter((p) => contextItemKey(p) !== contextItemKey(item))
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="thread-body" className="text-sm font-medium text-gray-800">
                  Innhold
                </label>
                <button
                  type="button"
                  onClick={insertMention}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                  title="Nevn bruker"
                >
                  <AtSign className="h-3.5 w-3.5" /> Nevn
                </button>
              </div>
              <ForumBodyComposer
                id="thread-body"
                textareaRef={bodyRef}
                rows={12}
                value={body}
                onChange={setBody}
                linkedItems={linkedItems}
                maxLength={FORUM_LIMITS.bodyMax}
                placeholder="Skriv innlegget ditt. Referanser legges inn automatisk når du velger fra søket over."
              />
              <p className="mt-1.5 text-xs text-gray-500">
                {body.length}/{FORUM_LIMITS.bodyMax} tegn
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 max-w-md">
              {displayName ? (
                <>
                  Du publiserer som <strong>{displayName}</strong>. Innlegget er offentlig og kan ikke
                  publiseres anonymt.
                </>
              ) : (
                'Tips: Nevn politikere med @ for å gi dem varsel hvis de er registrerte brukere.'
              )}
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                title.trim().length < FORUM_LIMITS.titleMin || !body.trim() || isSubmitting
              }
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:ml-auto"
            >
              {isSubmitting ? 'Oppretter…' : 'Publiser diskusjon'}
            </button>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        {quickSuggestions.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80">
            <h3 className="text-sm font-bold text-gray-900">Populære saker</h3>
            <div className="mt-3 space-y-1">
              {quickSuggestions.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => handleSelect(sakContextItem(issue.id, issue.title))}
                  className="w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50"
                >
                  <span className="line-clamp-2 font-medium text-gray-900">{issue.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {primarySakId && (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80">
            <h3 className="text-sm font-bold text-gray-900">Relatert til hovedsaken</h3>
            {loadingRelated ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Henter forslag…
              </div>
            ) : relatedItems.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">Ingen ekstra forslag for denne saken.</p>
            ) : (
              <div className="mt-3 space-y-1">
                {relatedItems.map((item) => (
                  <button
                    key={contextItemKey(item)}
                    type="button"
                    onClick={() => handleSelect(item)}
                    disabled={linkedKeys.has(contextItemKey(item))}
                    className="w-full rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-gray-100 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <span className="line-clamp-2 font-medium text-gray-900">{item.title}</span>
                    {item.subtitle && (
                      <span className="mt-0.5 block text-xs text-gray-500">{item.subtitle}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-950">
            <Lightbulb className="h-4 w-4" />
            Slik fungerer koblinger
          </h3>
          <ul className="space-y-2.5 text-xs text-indigo-950/90">
            <li className="flex gap-2">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Første sak du velger blir <strong>hovedsak</strong> på tråden.</span>
            </li>
            <li className="flex gap-2">
              <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Høringer og relaterte saker legges som referanser i teksten.</span>
            </li>
            <li className="flex gap-2">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Politikere nevnes med @ og lenke til Stortinget.</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
