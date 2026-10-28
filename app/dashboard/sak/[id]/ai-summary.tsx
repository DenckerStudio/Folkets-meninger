'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { Children } from 'react';
import {
  AlertCircle,
  CircleDollarSign,
  ExternalLink,
  FileText,
  HandHeart,
  Loader2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CivicBubble } from '@/components/icons/civic';
import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';
import { BiasReportLink } from '@/components/trust/bias-report-link';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { Dialog } from '@/components/ui/dialog';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { AI_SUMMARY_LABEL } from '@/lib/trust/ai-transparency';
import { routes } from '@/lib/routes';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import { isDisplayableAiSummaryKostnad } from '@/lib/ai-summary/display-kostnad';
import {
  classifySakSummaryHttpResponse,
  parseReadySakSummary,
  publicSakSummaryLead,
  retryAfterSeconds,
  sakSummaryReadyFromStored,
  SAK_SUMMARY_GENERATING_MESSAGE,
  SAK_SUMMARY_READ_FAILED_MESSAGE,
  SAK_SUMMARY_TIMEOUT_MESSAGE,
  type SakSummaryReady,
} from '@/lib/ai-summary/sak-summary-fetch';
import type { AiSummary as StoredAiSummary } from '@/lib/ai-summary/types';
import {
  isActivePollGeneration,
  loadStateAfterDialogClose,
  refetchOnNextOpenAfterClose,
  shouldRefetchOnDialogOpen,
  type SummaryLoadState,
} from '@/lib/ai-summary/sak-summary-dialog-state';
import type { AiSummaryLegacy, AiSummaryV2 } from '@/lib/ai-summary/types';

type SourceDoc = {
  title: string;
  sourceUrl: string;
};

export default function AiSummary({
  sakId,
  stortingetPageUrl,
  initialSummary = null,
}: {
  sakId: string;
  stortingetPageUrl?: string | null;
  /** Row from issue_ai_summaries. Shown whether or not an admin has reviewed it. */
  initialSummary?: StoredAiSummary | null;
}) {
  const headingId = useId();
  const showTooltips = useSakTooltipsEnabled();
  const seeded = sakSummaryReadyFromStored(initialSummary);
  const [open, setOpen] = useState(false);
  const [loadState, setLoadState] = useState<SummaryLoadState>(seeded ? 'ready' : 'idle');
  const [data, setData] = useState<SakSummaryReady | null>(seeded);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sourceDocs, setSourceDocs] = useState<SourceDoc[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const isAdmin = useIsAdmin();
  const pollGenerationRef = useRef(0);
  const refetchOnNextOpenRef = useRef(false);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const loading = loadState === 'loading';

  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
    };
  }, []);

  async function loadSourceDocuments() {
    try {
      const res = await fetch(`/api/sak/${sakId}/documents`);
      const json = (await res.json().catch(() => ({}))) as {
        documents?: Array<{ title?: string; sourceUrl?: string | null }>;
      };
      const docs = (json.documents ?? [])
        .map((doc) => ({
          title: String(doc.title ?? 'Dokument').trim(),
          sourceUrl: typeof doc.sourceUrl === 'string' ? doc.sourceUrl.trim() : '',
        }))
        .filter((doc) => doc.sourceUrl.length > 0)
        .slice(0, 10);
      setSourceDocs(docs);
    } catch {
      setSourceDocs([]);
    }
  }

  function cancelActiveSummaryPoll() {
    pollGenerationRef.current += 1;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
  }

  async function fetchSummaryOnce(signal: AbortSignal): Promise<
    | { kind: 'ready'; summary: SakSummaryReady }
    | { kind: 'pending'; retryAfterSeconds: number }
    | { kind: 'read_failed' }
    | { kind: 'error' }
  > {
    try {
      const res = await fetch(`/api/sak/${sakId}/ai-summary`, {
        signal,
      });

      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const kind = classifySakSummaryHttpResponse(res.status, json);

      if (kind === 'read_failed') {
        return { kind: 'read_failed' };
      }

      const ready = res.ok ? parseReadySakSummary(json) : null;
      if (ready) {
        return { kind: 'ready', summary: ready };
      }

      if (kind === 'pending') {
        return { kind: 'pending', retryAfterSeconds: retryAfterSeconds(json) };
      }

      return { kind: 'error' };
    } catch (error) {
      if (signal.aborted) {
        return { kind: 'error' };
      }
      console.error('Failed to fetch AI summary', error);
      return { kind: 'error' };
    }
  }

  async function loadSummary(pollUntilReady = true) {
    const generation = pollGenerationRef.current + 1;
    pollGenerationRef.current = generation;

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30_000);

    setLoadState('loading');
    setStatusMessage(null);
    void loadSourceDocuments();

    const MAX_ATTEMPTS = pollUntilReady ? 8 : 1;

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (!isActivePollGeneration(generation, pollGenerationRef.current)) {
          return;
        }

        const result = await fetchSummaryOnce(controller.signal);

        if (
          controller.signal.aborted ||
          !isActivePollGeneration(generation, pollGenerationRef.current)
        ) {
          return;
        }

        if (result.kind === 'read_failed') {
          setLoadState('read_failed');
          setStatusMessage(SAK_SUMMARY_READ_FAILED_MESSAGE);
          return;
        }

        if (result.kind === 'ready') {
          setLoadState('ready');
          setStatusMessage(null);
          setData(result.summary);
          return;
        }

        if (result.kind === 'pending') {
          setStatusMessage(SAK_SUMMARY_GENERATING_MESSAGE);
          if (!pollUntilReady || attempt === MAX_ATTEMPTS - 1) {
            break;
          }
          await new Promise((r) => setTimeout(r, result.retryAfterSeconds * 1000));
          if (!isActivePollGeneration(generation, pollGenerationRef.current)) {
            return;
          }
          continue;
        }

        if (!pollUntilReady || attempt === MAX_ATTEMPTS - 1) {
          break;
        }
        setStatusMessage(SAK_SUMMARY_GENERATING_MESSAGE);
        await new Promise((r) => setTimeout(r, 15_000));
        if (!isActivePollGeneration(generation, pollGenerationRef.current)) {
          return;
        }
      }

      if (!isActivePollGeneration(generation, pollGenerationRef.current)) {
        return;
      }

      setLoadState('timeout');
      setStatusMessage(SAK_SUMMARY_TIMEOUT_MESSAGE);
    } finally {
      clearTimeout(timeout);
      if (fetchAbortRef.current === controller) {
        fetchAbortRef.current = null;
      }
    }
  }

  function openSummary() {
    setOpen(true);
    if (shouldRefetchOnDialogOpen(Boolean(data), refetchOnNextOpenRef.current)) {
      refetchOnNextOpenRef.current = false;
      void loadSummary(true);
      return;
    }
    if (data) {
      setLoadState('ready');
      setStatusMessage(null);
    }
  }

  function closeSummary() {
    cancelActiveSummaryPoll();
    refetchOnNextOpenRef.current = refetchOnNextOpenAfterClose(Boolean(data), loadState);
    setLoadState((current) => loadStateAfterDialogClose(Boolean(data), current));
    setStatusMessage(null);
    setOpen(false);
  }

  function retrySummary() {
    void loadSummary(true);
  }

  const showRetry =
    loadState === 'read_failed' || loadState === 'timeout';
  const lead = publicSakSummaryLead(data);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="inline-flex items-center rounded-full border border-[#ba0c2f]/25 bg-[#ba0c2f]/[0.06] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#ba0c2f]"
      >
        {AI_SUMMARY_LABEL}
      </span>
      <button
        type="button"
        onClick={openSummary}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CivicBubble className="h-3.5 w-3.5" />
        {lead ? 'Hele sammendraget' : 'Les sammendrag'}
      </button>
      <Link
        href={routes.omAi}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-brand hover:underline"
      >
        Om modellen
      </Link>
      {isAdmin ? (
        <button
          type="button"
          disabled={loading || !data}
          onClick={() => setShowFeedback((value) => !value)}
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          title={!data && !loading ? 'Sammendraget må lastes først' : undefined}
        >
          Vurder sammendrag
        </button>
      ) : null}

      {isAdmin && showFeedback && data ? (
        <ContentFeedbackPanel
          className="mt-2 w-full"
          contentType="ai_summary"
          contentId={sakId}
          title="Vurder sammendraget"
          onSkip={() => setShowFeedback(false)}
          onSaved={() => setShowFeedback(false)}
        />
      ) : null}

      {lead ? (
        <p className="basis-full text-base leading-relaxed text-foreground">{lead}</p>
      ) : null}

      <Dialog
        open={open}
        onClose={closeSummary}
        title={
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span id={headingId}>{AI_SUMMARY_LABEL}</span>
            {showTooltips ? (
              <InfoTooltip
                label="Sammendraget"
                description={SAK_META_TOOLTIPS.aiSammendrag}
                side="bottom"
              />
            ) : null}
          </span>
        }
        description="Generert fra saksdokumenter av en språkmodell på våre egne servere. Ikke offisiell Stortinget-tekst."
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <BiasReportLink pagePath={routes.sak(sakId)} />
              <Link
                href={routes.omAi}
                className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-brand hover:underline"
              >
                AI-transparens
              </Link>
            </div>
            <button
              type="button"
              onClick={closeSummary}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90 sm:w-auto"
            >
              Lukk
            </button>
          </div>
        }
      >
        <SummarySources
          stortingetPageUrl={stortingetPageUrl}
          sourceDocs={sourceDocs}
        />
        {loading ? (
          <div className="space-y-4" aria-live="polite">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
              {statusMessage ?? 'Henter sammendrag …'}
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted/80" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted/80" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted/80" />
            </div>
          </div>
        ) : data ? (
          data.version === 2 ? <V2Summary data={data} /> : <LegacySummary data={data} />
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 px-4 py-4">
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'text-sm text-muted-foreground',
                loadState === 'read_failed' && 'flex items-start gap-2',
              )}
            >
              {loadState === 'read_failed' ? (
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
              <span>
                {statusMessage ??
                  'Sammendrag genereres når dokumentene er klare. Prøv igjen senere.'}
              </span>
            </p>
            {showRetry ? (
              <button
                type="button"
                onClick={retrySummary}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
              >
                Prøv igjen
              </button>
            ) : null}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function SummarySources({
  stortingetPageUrl,
  sourceDocs,
}: {
  stortingetPageUrl?: string | null;
  sourceDocs: SourceDoc[];
}) {
  const hasLinks = Boolean(stortingetPageUrl) || sourceDocs.length > 0;
  if (!hasLinks) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
      <p className="font-medium text-foreground">Kilder på Stortinget</p>
      <ul className="mt-2 space-y-1.5">
        {stortingetPageUrl ? (
          <li>
            <a
              href={stortingetPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand hover:underline"
            >
              Sak på stortinget.no
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </li>
        ) : null}
        {sourceDocs.map((doc) => (
          <li key={doc.sourceUrl}>
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand hover:underline"
            >
              {doc.title}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactTileGrid({ children }: { children: ReactNode }) {
  const tiles = Children.toArray(children);
  const oddLastSpan = tiles.length % 2 === 1;

  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-2',
        oddLastSpan && 'sm:[&>*:last-child]:col-span-2',
      )}
    >
      {children}
    </div>
  );
}

function FactTile({
  icon: Icon,
  label,
  text,
  bodyClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  text: string;
  bodyClassName?: string;
}) {
  if (!text.trim()) return null;

  return (
    <article className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <p
        className={cn(
          'text-sm leading-relaxed break-words text-foreground',
          bodyClassName,
        )}
      >
        {text}
      </p>
    </article>
  );
}

function V2Summary({ data }: { data: AiSummaryV2 }) {
  return (
    <div className="min-w-0 space-y-4">
      {data.labels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.labels.map((label) => (
            <span
              key={label}
              className="inline-flex max-w-full rounded-full border border-border bg-card px-3 py-1 text-xs font-medium break-words text-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {data.narrative ? (
        <p className="text-base leading-relaxed break-words text-foreground">{data.narrative}</p>
      ) : null}

      {data.forslag.length > 0 ? (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Forslagene ({data.forslag.length})
          </h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
            {data.forslag.map((item, index) => (
              <li key={`${index}-${item.slice(0, 48)}`} className="break-words pl-1">
                {item}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <FactTileGrid>
        {data.who_affected.trim() ? (
          <FactTile icon={Users} label="Hvem berøres?" text={data.who_affected} />
        ) : null}
        {data.how_affected.trim() ? (
          <FactTile
            icon={HandHeart}
            label="Hvordan berøres de?"
            text={data.how_affected}
            bodyClassName="whitespace-pre-line"
          />
        ) : null}
        {isDisplayableAiSummaryKostnad(data.kostnad) ? (
          <FactTile icon={CircleDollarSign} label="Økonomi og kostnad" text={data.kostnad!} />
        ) : null}
      </FactTileGrid>

      {data.topic_cards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {data.topic_cards.map((card) => (
            <FactTile key={card.title} icon={FileText} label={card.title} text={card.body} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegacySummary({ data }: { data: AiSummaryLegacy }) {
  return (
    <div className="min-w-0 space-y-4">
      {data.hva.trim() ? (
        <p className="text-base leading-relaxed break-words text-foreground">{data.hva}</p>
      ) : null}
      <FactTileGrid>
        <FactTile icon={Users} label="Hvem berøres?" text={data.hvem} />
        {isDisplayableAiSummaryKostnad(data.kostnad) ? (
          <FactTile icon={CircleDollarSign} label="Økonomi og kostnad" text={data.kostnad} />
        ) : null}
      </FactTileGrid>
    </div>
  );
}
