'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogIn, Send } from 'lucide-react';
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
import {
  ForumComposerAttachments,
  type ComposerAttachPanel,
} from '@/components/forum/forum-composer-attachments';

type ForumOpinionComposerProps = {
  sakId?: string | null;
  sakTitle?: string | null;
  suggestedIssues?: { id: string; title: string }[];
};

const inputClass =
  'min-h-[2.75rem] w-full flex-1 resize-none border-0 bg-transparent py-2.5 pr-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none';

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
  const [attachPanel, setAttachPanel] = useState<ComposerAttachPanel>(null);
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

      if (item.kind === 'politician') {
        const handle = `@${item.title.split(/\s+/)[0]}`;
        setStatement((prev) => {
          if (prev.includes(handle)) return prev;
          const needsSpace = prev.length > 0 && !prev.endsWith(' ');
          return `${prev}${needsSpace ? ' ' : ''}${handle} `;
        });
      }
    },
    [appendContext, primarySakId],
  );

  const handleRemoveItem = useCallback((item: ForumContextItem) => {
    setLinkedItems((prev) => prev.filter((p) => contextItemKey(p) !== contextItemKey(item)));
    if (item.kind === 'sak' && item.id === primarySakId) {
      setPrimarySakId(null);
      setPrimarySakTitle(null);
    }
  }, [primarySakId]);

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

  const canPublish = statement.trim().length >= 1;

  const focusStatement = useCallback(() => {
    statementRef.current?.focus();
  }, []);

  if (!user) {
    return (
      <section
        id="del-din-mening"
        className="mb-8 border-b border-gray-100 pb-8 text-center"
      >
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">Del din mening</h2>
        <p className="mt-1.5 text-sm text-gray-500">Logg inn for å dele hva du mener.</p>
        <Link
          href={routes.login}
          className="mt-4 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
        >
          <LogIn className="mr-1.5 h-4 w-4" aria-hidden />
          Logg inn
        </Link>
      </section>
    );
  }

  return (
    <section id="del-din-mening" className="mb-8 border-b border-gray-100 pb-8">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">Del din mening</h2>
      <p className="mt-1 text-sm text-gray-500">Skriv etter «Jeg mener». Legg ved saker, politikere eller kilder under.</p>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {showDraftChoice && pendingDraft ? (
        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-4">
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
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
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
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Start på nytt
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="forum-opinion-statement" className="sr-only">
            Din mening
          </label>
          <div className="flex items-start rounded-2xl bg-gray-50/90 px-4 py-1 focus-within:bg-gray-100/90 focus-within:ring-2 focus-within:ring-indigo-500/10">
            <span className="shrink-0 py-2.5 pr-2 text-sm font-medium text-gray-500" aria-hidden>
              Jeg mener
            </span>
            <textarea
              id="forum-opinion-statement"
              ref={statementRef}
              rows={2}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={FORUM_LIMITS.bodyMax - FORUM_OPINION_PREFIX.length}
              className={inputClass}
              placeholder="vi bør begrense AI i skole og arbeidslivet"
            />
          </div>

          <ForumComposerAttachments
            panel={attachPanel}
            onPanelChange={setAttachPanel}
            linkedItems={linkedItems}
            linkedKeys={linkedKeys}
            primarySakId={primarySakId}
            onSelect={handleSelect}
            onRemove={handleRemoveItem}
            onSetPrimarySak={(id, title) => {
              setPrimarySakId(id);
              setPrimarySakTitle(title);
            }}
            suggestedIssues={suggestedIssues}
            onPoliticianPanelOpen={focusStatement}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-400">
          {displayName ? (
            <>
              Som <span className="text-gray-600">{displayName}</span> · offentlig innlegg
            </>
          ) : (
            'Vises med fornavn og etternavn.'
          )}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canPublish || isSubmitting}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-gray-800 disabled:opacity-40"
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
