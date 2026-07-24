'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileText, Loader2, LogIn, Send } from 'lucide-react';
import { FORUM_LIMITS } from '@/lib/forum/validation';
import {
  contextItemKey,
  insertContextIntoBody,
  sakContextItem,
  type ForumContextItem,
} from '@/lib/forum/context';
import { FORUM_OPINION_PREFIX } from '@/lib/forum/forum-rules';
import { routes } from '@/lib/routes';
import {
  clearForumThreadDraft,
  loadForumThreadDraft,
  saveForumThreadDraft,
  type ForumThreadDraft,
} from '@/lib/forum/thread-draft-storage';
import ContextPicker, { ContextChip } from '@/components/forum/context-picker';

type ForumOpinionComposerProps = {
  sakId?: string | null;
  sakTitle?: string | null;
  suggestedIssues?: { id: string; title: string }[];
};

const inputClass =
  'w-full min-h-[3rem] resize-y rounded-xl border-0 bg-gray-50 px-4 py-3 text-sm text-gray-900 shadow-sm ring-1 ring-gray-200 transition-shadow placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30';

function stripOpinionPrefix(text: string): string {
  const trimmed = text.trim();
  if (trimmed.toLowerCase().startsWith(FORUM_OPINION_PREFIX.toLowerCase())) {
    return trimmed.slice(FORUM_OPINION_PREFIX.length).trimStart();
  }
  return trimmed;
}

function buildOpinionBody(statement: string): string {
  return `${FORUM_OPINION_PREFIX}${statement.trim()}`;
}

function buildThreadTitle(statement: string): string {
  const full = buildOpinionBody(statement);
  if (full.length <= FORUM_LIMITS.titleMax) return full;
  return `${full.slice(0, FORUM_LIMITS.titleMax - 1).trimEnd()}…`;
}

export function ForumOpinionComposer({
  sakId: initialSakId,
  sakTitle: initialSakTitle,
  suggestedIssues = [],
}: ForumOpinionComposerProps) {
  const [statement, setStatement] = useState('');
  const [primarySakId, setPrimarySakId] = useState<string | null>(initialSakId || null);
  const [primarySakTitle, setPrimarySakTitle] = useState<string | null>(initialSakTitle || null);
  const [linkedItems, setLinkedItems] = useState<ForumContextItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(true);
  const [pendingDraft, setPendingDraft] = useState<ForumThreadDraft | null>(null);
  const [showDraftChoice, setShowDraftChoice] = useState(false);
  const statementRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    if (!initialSakId || !initialSakTitle) return;
    setPrimarySakId(initialSakId);
    setPrimarySakTitle(initialSakTitle);
    setLinkedItems((prev) => {
      const key = contextItemKey(sakContextItem(initialSakId, initialSakTitle));
      if (prev.some((p) => contextItemKey(p) === key)) return prev;
      return [...prev, sakContextItem(initialSakId, initialSakTitle)];
    });
  }, [initialSakId, initialSakTitle]);

  const linkedKeys = useMemo(
    () => new Set(linkedItems.map(contextItemKey)),
    [linkedItems],
  );

  const applyDraft = useCallback(
    (draft: ForumThreadDraft) => {
      setStatement(stripOpinionPrefix(draft.body || draft.title));
      setLinkedItems(draft.linkedItems);
      if (!initialSakId) {
        setPrimarySakId(draft.primarySakId);
        setPrimarySakTitle(draft.primarySakTitle);
      }
    },
    [initialSakId],
  );

  const resetForm = useCallback(() => {
    setStatement('');
    setLinkedItems([]);
    if (!initialSakId) {
      setPrimarySakId(null);
      setPrimarySakTitle(null);
    } else if (initialSakTitle) {
      setLinkedItems([sakContextItem(initialSakId, initialSakTitle)]);
    }
  }, [initialSakId, initialSakTitle]);

  useEffect(() => {
    const draft = loadForumThreadDraft();
    if (draft) {
      setPendingDraft(draft);
      setShowDraftChoice(true);
    } else {
      draftHydrated.current = true;
    }
  }, []);

  const persistDraft = useCallback(() => {
    if (!draftHydrated.current) return;
    saveForumThreadDraft({
      title: '',
      body: statement,
      primarySakId,
      primarySakTitle,
      linkedItems,
    });
  }, [statement, primarySakId, primarySakTitle, linkedItems]);

  useEffect(() => {
    if (!draftHydrated.current) return;
    const t = setTimeout(persistDraft, 500);
    return () => clearTimeout(t);
  }, [persistDraft]);

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
  }, []);

  const handleSelect = useCallback(
    (item: ForumContextItem) => {
      if (item.kind === 'sak' && !primarySakId) {
        appendContext(item, true);
        return;
      }
      appendContext(item, false);
    },
    [appendContext, primarySakId],
  );

  const handleSubmit = async () => {
    const trimmed = statement.trim();
    if (!trimmed || isSubmitting) return;

    const title = buildThreadTitle(trimmed);
    let body = buildOpinionBody(trimmed);
    for (const item of linkedItems) {
      body = insertContextIntoBody(body, item);
    }

    if (!hasIdentity) {
      const next = initialSakId ? `${routes.forum}?sak=${initialSakId}` : routes.forum;
      router.push(`${routes.completeProfile}?next=${encodeURIComponent(next)}`);
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
          title,
          body: body.trim(),
          stortinget_issue_id: primarySakId,
          context_items: linkedItems,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Kunne ikke publisere innlegget');
        return;
      }

      clearForumThreadDraft();
      resetForm();
      router.push(routes.forumTopic(data.threadId));
      router.refresh();
    } catch {
      setError('En feil oppstod');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickSuggestions = suggestedIssues.filter((s) => s.id !== primarySakId).slice(0, 3);
  const canPublish = statement.trim().length >= 1;

  if (!user) {
    return (
      <section
        id="del-din-mening"
        className="mb-6 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center shadow-sm sm:px-6"
      >
        <h2 className="text-lg font-bold text-gray-900">Del din mening</h2>
        <p className="mt-2 text-sm text-gray-600">Logg inn for å dele hva du mener om saker og samfunn.</p>
        <Link
          href={routes.login}
          className="mt-4 inline-flex items-center font-medium text-indigo-600 hover:text-indigo-500"
        >
          <LogIn className="mr-1.5 h-4 w-4" aria-hidden />
          Logg inn
        </Link>
      </section>
    );
  }

  return (
    <section
      id="del-din-mening"
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-gray-200/80 sm:p-6"
    >
      <h2 className="text-lg font-bold text-gray-900">Del din mening</h2>
      <p className="mt-1 text-sm text-gray-600">
        Start med «Jeg mener», og legg ved saker du syns er relevante.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      ) : null}

      {showDraftChoice && pendingDraft ? (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-4">
          <p className="text-sm font-semibold text-gray-900">Du har et lagret utkast</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                applyDraft(pendingDraft);
                setPendingDraft(null);
                setShowDraftChoice(false);
                draftHydrated.current = true;
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Fortsett utkast
            </button>
            <button
              type="button"
              onClick={() => {
                clearForumThreadDraft();
                resetForm();
                setPendingDraft(null);
                setShowDraftChoice(false);
                draftHydrated.current = true;
              }}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50"
            >
              Start på nytt
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="forum-opinion-statement" className="sr-only">
            Din mening
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <span
              className="inline-flex shrink-0 items-center rounded-xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100 sm:mt-0"
              aria-hidden
            >
              Jeg mener
            </span>
            <textarea
              id="forum-opinion-statement"
              ref={statementRef}
              rows={3}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={FORUM_LIMITS.bodyMax - FORUM_OPINION_PREFIX.length}
              className={inputClass}
              placeholder="vi bør begrense AI i skole og arbeidslivet"
            />
          </div>
          {statement.trim() ? (
            <p className="mt-2 text-xs text-gray-500">
              Forhåndsvisning:{' '}
              <span className="text-gray-700">{buildOpinionBody(statement)}</span>
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-800">
            <FileText className="h-4 w-4 text-indigo-600" aria-hidden />
            Relevante saker
          </p>
          <ContextPicker
            onSelect={handleSelect}
            selectedKeys={linkedKeys}
            placeholder="Søk og legg ved stortingssaker…"
            lockedKind="sak"
            compact
          />
          {linkedItems.length > 0 ? (
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
                  onRemove={() => {
                    setLinkedItems((prev) =>
                      prev.filter((p) => contextItemKey(p) !== contextItemKey(item)),
                    );
                    if (item.kind === 'sak' && item.id === primarySakId) {
                      setPrimarySakId(null);
                      setPrimarySakTitle(null);
                    }
                  }}
                />
              ))}
            </div>
          ) : null}
          {quickSuggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {quickSuggestions.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => handleSelect(sakContextItem(issue.id, issue.title))}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs font-medium text-gray-800 transition-colors hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <span className="line-clamp-1">{issue.title}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          {displayName ? (
            <>
              Publiserer som <strong>{displayName}</strong>. Innlegget er offentlig.
            </>
          ) : (
            'Innlegget vises med fornavn og etternavn.'
          )}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canPublish || isSubmitting}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Publiserer…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Publiser
            </>
          )}
        </button>
      </div>
    </section>
  );
}
