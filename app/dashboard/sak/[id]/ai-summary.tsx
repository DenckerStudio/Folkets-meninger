'use client';

import { useId, useRef, useState } from 'react';
import { BrainCircuit, CircleDollarSign, Loader2, Users } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { SAK_META_TOOLTIPS } from '@/lib/stortinget-sak-tooltips';
import { useSakTooltipsEnabled } from '@/components/theme-provider';
import type { AiSummaryLegacy, AiSummaryV2, TopicCard } from '@/lib/ai-summary/types';

type SummaryData =
  | ({ version: 2 } & AiSummaryV2 & { cached?: boolean })
  | ({ version: 1 } & AiSummaryLegacy & { cached?: boolean });

function isReadySummary(json: Record<string, unknown>): SummaryData | null {
  if (json.version === 2 && typeof json.narrative === 'string') {
    return {
      version: 2,
      narrative: json.narrative,
      who_affected: String(json.who_affected ?? ''),
      how_affected: String(json.how_affected ?? ''),
      topic_cards: Array.isArray(json.topic_cards)
        ? (json.topic_cards as TopicCard[])
        : [],
      labels: Array.isArray(json.labels) ? (json.labels as string[]) : [],
      cached: json.cached === true,
    };
  }

  if (typeof json.hva === 'string') {
    return {
      version: 1,
      hva: json.hva,
      hvem: String(json.hvem ?? ''),
      kostnad: String(json.kostnad ?? ''),
      cached: json.cached === true,
    };
  }

  return null;
}

export default function AiSummary({ sakId }: { sakId: string }) {
  const headingId = useId();
  const showTooltips = useSakTooltipsEnabled();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SummaryData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  async function loadSummary() {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);

    const MAX_ATTEMPTS = 8;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const res = await fetch(`/api/sak/${sakId}/ai-summary`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        const json = await res.json().catch(() => ({}));
        const ready = isReadySummary(json);

        if (res.ok && ready) {
          setStatusMessage(null);
          setData(ready);
          setLoading(false);
          return;
        }

        const retryAfterSeconds =
          typeof json?.retry_after_seconds === 'number' && json.retry_after_seconds > 0
            ? json.retry_after_seconds
            : 15;

        setStatusMessage('Genererer AI-sammendrag (kan ta noen minutter) …');
        setLoading(true);
        await new Promise((r) => setTimeout(r, retryAfterSeconds * 1000));
      } catch (error) {
        console.error('Failed to fetch AI summary', error);
        setStatusMessage('Venter på AI-sammendrag …');
        setLoading(true);
        await new Promise((r) => setTimeout(r, 15_000));
      }
    }

    setLoading(false);
    setStatusMessage('Sammendraget er ikke klart ennå.');
    setData(null);
  }

  function openSummary() {
    setOpen(true);
    void loadSummary();
  }

  return (
    <div>
      <button
        type="button"
        onClick={openSummary}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <BrainCircuit className="h-3.5 w-3.5" aria-hidden />
        Vis AI-sammendrag
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className="inline-flex items-center gap-2">
            <span id={headingId}>AI-sammendrag</span>
            {showTooltips ? (
              <InfoTooltip
                label="AI-sammendraget"
                description={SAK_META_TOOLTIPS.aiSammendrag}
                side="bottom"
              />
            ) : null}
          </span>
        }
        description="Generert av AI fra saksdokumentene. Dette er ikke et offisielt Stortinget-sammendrag."
        size="lg"
      >
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
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
            {statusMessage ?? 'AI-sammendrag kommer når saken er behandlet av n8n.'}
          </p>
        )}
      </Dialog>
    </div>
  );
}

function FactTile({
  icon: Icon,
  label,
  text,
}: {
  icon: typeof BrainCircuit;
  label: string;
  text: string;
}) {
  if (!text.trim()) return null;

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
        {label}
      </div>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </article>
  );
}

function V2Summary({ data }: { data: AiSummaryV2 }) {
  return (
    <div className="space-y-4">
      {data.labels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.labels.map((label) => (
            <span
              key={label}
              className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {data.narrative ? (
        <p className="text-base leading-relaxed text-foreground">{data.narrative}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FactTile icon={Users} label="Hvem berøres?" text={data.who_affected} />
        <FactTile icon={CircleDollarSign} label="Hvordan berøres de?" text={data.how_affected} />
      </div>

      {data.topic_cards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-3">
          {data.topic_cards.map((card) => (
            <FactTile key={card.title} icon={BrainCircuit} label={card.title} text={card.body} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LegacySummary({ data }: { data: AiSummaryLegacy }) {
  return (
    <div className="space-y-4">
      {data.hva.trim() ? (
        <p className="text-base leading-relaxed text-foreground">{data.hva}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FactTile icon={Users} label="Hvem berøres?" text={data.hvem} />
        <FactTile icon={CircleDollarSign} label="Økonomi og kostnad" text={data.kostnad} />
      </div>
    </div>
  );
}
