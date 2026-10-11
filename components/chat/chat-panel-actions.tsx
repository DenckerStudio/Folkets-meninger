'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown, FileSearch, Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import {
  SAK_CONTEXT_QUERY_MIN,
  type SakContextActionResult,
} from '@/lib/chat/actions';
import { issueIdFromPathname } from '@/lib/chat/overlay';
import { cn } from '@/lib/utils';

type ChatPanelActionsProps = {
  issueId?: string | null;
  issueTitle?: string | null;
  compact?: boolean;
};

/**
 * Chat overlay keeps only sak-context as a direct action.
 * Spellcheck + updated-source search live in the opinion composer.
 *
 * On phones the form starts collapsed (the conversation gets the height) and the
 * header acts as a toggle; on wider screens it is always open via `sm:block`.
 */
export function ChatPanelActions({
  issueId,
  compact = false,
}: ChatPanelActionsProps) {
  const pathname = usePathname();
  const defaultIssueId = issueId?.trim() || issueIdFromPathname(pathname) || '';
  const [open, setOpen] = useState(false);

  return (
    <div
      data-chat-actions=""
      className={cn('shrink-0 border-b border-border', compact ? 'px-0 py-2 sm:py-3' : 'px-4 py-3')}
    >
      <button
        type="button"
        data-chat-action="sak"
        aria-expanded={open}
        aria-controls="chat-sak-context-form"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-sm font-medium text-foreground"
      >
        <span className="inline-flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-brand" aria-hidden />
          Hent sakskontekst
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform sm:hidden',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <p
        className={cn(
          'mt-1.5 text-xs text-muted-foreground',
          open ? 'block' : 'hidden sm:block',
        )}
      >
        Direkte handling — uten å starte en samtale.
      </p>
      <div className={cn(open ? 'block' : 'hidden', 'sm:block')}>
        <SakContextForm defaultIssueId={defaultIssueId} />
      </div>
    </div>
  );
}

function SakContextForm({ defaultIssueId }: { defaultIssueId: string }) {
  const [issueInput, setIssueInput] = useState(defaultIssueId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SakContextActionResult | null>(null);

  const canSubmit = issueInput.trim().length >= SAK_CONTEXT_QUERY_MIN;

  const submit = async () => {
    const value = issueInput.trim();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/chat/sak-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId: value, query: value }),
      });
      const json = (await res.json()) as SakContextActionResult & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Kunne ikke hente sakskontekst.');
      }
      setResult(json);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Kunne ikke hente sakskontekst.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      id="chat-sak-context-form"
      className="mt-2 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !canSubmit) return;
        void submit();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Henter sak, sammendrag og dokumentutdrag fra vår cache. Ingen språkmodell.
      </p>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Sak-id eller tittel</span>
          <input
            value={issueInput}
            onChange={(event) => setIssueInput(event.target.value)}
            placeholder="Sak-id eller tittel"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <Button type="submit" size="sm" disabled={busy || !canSubmit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Hent
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? <SakContextResultView result={result} /> : null}
    </form>
  );
}

function SakContextResultView({ result }: { result: SakContextActionResult }) {
  if (!result.issue) {
    return (
      <EmptyState
        compact
        className="border-dashed px-3 py-4"
        title="Ingen sak funnet"
        description={result.note || 'Fant ingen matching sak i vår cache. Prøv sak-id eller en mer konkret tittel.'}
      />
    );
  }

  if (result.empty) {
    return (
      <div data-sak-context-result="empty" className="space-y-2">
        <p className="text-xs font-medium text-foreground">
          Sak {result.issue.id}
          {result.issue.title ? ` · ${result.issue.title}` : ''}
        </p>
        <EmptyState
          compact
          className="border-dashed px-3 py-4"
          title="Ingen sakskontekst ennå"
          description={
            result.note ||
            'Ingen dokumentutdrag eller sammendrag som handler om denne saken er indeksert ennå.'
          }
        />
      </div>
    );
  }

  return (
    <div data-sak-context-result="ready" className="space-y-2">
      <p className="text-xs font-medium text-foreground">
        Sak {result.issue.id}
        {result.issue.title ? ` · ${result.issue.title}` : ''}
      </p>
      {result.summary ? (
        <div
          data-sak-context-summary=""
          className="space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2"
        >
          <p className="text-xs font-medium text-foreground">Sammendrag</p>
          <p className="whitespace-pre-wrap text-sm text-foreground">{result.summary}</p>
        </div>
      ) : (
        <EmptyState
          compact
          className="border-dashed px-3 py-4"
          title="Ingen sammendrag"
          description="Saken har dokumentutdrag, men ikke et sammendrag ennå."
        />
      )}
      {result.chunks.length > 0 ? (
        <ul data-sak-context-chunks="" className="space-y-2">
          {result.chunks.map((chunk) => (
            <li
              key={`${chunk.documentId}-${chunk.chunkIndex}`}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <p className="text-xs text-muted-foreground">
                Dokumentutdrag {chunk.chunkIndex + 1}
              </p>
              <p className="mt-1 text-sm text-foreground">{chunk.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          compact
          className="border-dashed px-3 py-4"
          title="Ingen dokumentutdrag"
          description={
            result.note || 'Ingen dokumentutdrag som handler om denne saken er indeksert ennå.'
          }
        />
      )}
    </div>
  );
}
