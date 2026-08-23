'use client';

import { useId, useState, useEffect } from 'react';
import { BrainCircuit, CircleDollarSign, Loader2, Users } from 'lucide-react';
import { motion } from 'motion/react';
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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryData | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      const MAX_ATTEMPTS = 12;

      for (let attempt = 0; attempt < MAX_ATTEMPTS && !cancelled; attempt += 1) {
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
            if (!cancelled) {
              setStatusMessage(null);
              setData(ready);
              setLoading(false);
            }
            return;
          }

          const retryAfterSeconds =
            typeof json?.retry_after_seconds === 'number' && json.retry_after_seconds > 0
              ? json.retry_after_seconds
              : 15;

          if (!cancelled) {
            setStatusMessage('Genererer AI-sammendrag (kan ta noen minutter) …');
            setLoading(true);
          }

          await new Promise((r) => setTimeout(r, retryAfterSeconds * 1000));
        } catch (error) {
          console.error('Failed to fetch AI summary', error);
          if (!cancelled) {
            setStatusMessage('Venter på AI-sammendrag …');
            setLoading(true);
          }
          await new Promise((r) => setTimeout(r, 15_000));
        }
      }

      if (!cancelled) {
        setLoading(false);
        setStatusMessage('Sammendraget er ikke klart ennå.');
        setData(null);
      }
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [sakId]);

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="border-l-[3px] border-brand bg-brand-soft px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2
              id={headingId}
              className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand"
            >
              <BrainCircuit className="h-4 w-4" aria-hidden />
              AI-sammendrag
            </h2>
            {showTooltips ? (
              <InfoTooltip
                label="AI-sammendraget"
                description={SAK_META_TOOLTIPS.aiSammendrag}
                side="bottom"
              />
            ) : null}
          </div>
          <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
            Nøytral · bokmål
          </span>
        </div>

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
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {data.version === 2 ? <V2Summary data={data} /> : <LegacySummary data={data} />}
          </motion.div>
        ) : (
          <p className="rounded-xl border border-border bg-card/70 px-4 py-4 text-sm text-muted-foreground">
            {statusMessage ?? 'AI-sammendrag kommer når saken er behandlet av n8n.'}
          </p>
        )}
      </div>
    </section>
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
    <article className="rounded-xl border border-border bg-card/80 p-4">
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
        <p className="text-base leading-relaxed text-foreground sm:text-lg">{data.narrative}</p>
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
        <p className="text-base leading-relaxed text-foreground sm:text-lg">{data.hva}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <FactTile icon={Users} label="Hvem berøres?" text={data.hvem} />
        <FactTile icon={CircleDollarSign} label="Økonomi og kostnad" text={data.kostnad} />
      </div>
    </div>
  );
}
