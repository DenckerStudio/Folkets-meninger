'use client';

import { useState } from 'react';
import { Check, Copy, MessagesSquare, Share2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { redditCommunityName, redditSubmitQuoteUrl } from '@/lib/reddit';
import { formatQuoteShareText, twitterIntentUrl, type QuoteShareDraft } from '@/lib/share';

export function SakQuoteDialog({
  open,
  title,
  getPageUrl,
  draft,
  onClose,
  onDraftChange,
}: {
  open: boolean;
  title: string;
  getPageUrl: () => string;
  draft: QuoteShareDraft;
  onClose: () => void;
  onDraftChange: (draft: QuoteShareDraft) => void;
}) {
  const [copied, setCopied] = useState(false);
  const quote = draft.quote.trim();
  const pageUrl = open ? getPageUrl() : '';
  const canShare = quote.length >= 8 && Boolean(pageUrl);

  const payloadText = formatQuoteShareText({
    quote,
    title,
    url: pageUrl,
    sourceLabel: draft.sourceLabel,
  });

  const copyQuote = async () => {
    if (!canShare) return;
    await navigator.clipboard.writeText(payloadText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    if (!canShare) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title,
          text: payloadText,
          url: pageUrl,
        });
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
      }
    }
    await copyQuote();
  };

  const redditHref = canShare
    ? redditSubmitQuoteUrl({
        title,
        url: pageUrl,
        quote,
        sourceLabel: draft.sourceLabel,
      })
    : undefined;

  const xHref = canShare
    ? twitterIntentUrl({
        title,
        url: pageUrl,
        quote,
        sourceLabel: draft.sourceLabel,
      })
    : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Del et sitat"
      description="Marker et avsnitt fra saken eller saksdokumentene, og del det med kilde og lenke."
      size="md"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyQuote()}
            disabled={!canShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Kopiert' : 'Kopier sitat'}
          </button>
          <button
            type="button"
            onClick={() => void nativeShare()}
            disabled={!canShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Share2 className="h-4 w-4" />
            Del
          </button>
          {redditHref ? (
            <a
              href={redditHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              <MessagesSquare className="h-4 w-4" />
              Diskuter i Reddit
            </a>
          ) : null}
          {xHref ? (
            <a
              href={xHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Del på X
            </a>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        {draft.sourceLabel ? (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{draft.sourceLabel}</p>
        ) : null}
        <textarea
          value={draft.quote}
          onChange={(event) => onDraftChange({ ...draft, quote: event.target.value })}
          rows={6}
          maxLength={2000}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder="Lim inn eller skriv sitatet du vil dele…"
        />
        <p className="text-xs text-muted-foreground">
          Innlegget åpnes i r/{redditCommunityName()} med saken som kilde. Reddit-konto kreves for å
          publisere.
        </p>
      </div>
    </Dialog>
  );
}
