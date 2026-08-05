'use client';

import { ShieldCheck, BrainCircuit, Users, Sparkles, Tag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import type { AiSummaryLegacy, AiSummaryV2, TopicCard } from '@/lib/ai-summary/types';

type SummaryData =
  | ({ version: 2 } & AiSummaryV2 & { cached?: boolean })
  | ({ version: 1 } & AiSummaryLegacy & { cached?: boolean });

function NorwegianFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 12"
      width={14}
      height={10}
      aria-hidden
    >
      <rect width="16" height="12" fill="#BA0C2F" />
      <rect x="4" width="3" height="12" fill="#fff" />
      <rect y="4" width="16" height="3" fill="#fff" />
      <rect x="4.5" width="2" height="12" fill="#00205B" />
      <rect y="4.5" width="16" height="2" fill="#00205B" />
    </svg>
  );
}

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

export default function AiSummary({
  sakId,
  title,
  summary,
}: {
  sakId: string;
  title: string;
  summary: string;
}) {
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
        setStatusMessage('Kunne ikke hente AI-sammendrag akkurat nå.');
        setData({
          version: 1,
          hva: `Saken handler om: ${title}`,
          hvem: 'Se saksdokumentene for detaljer.',
          kostnad:
            summary.includes('milliard') || summary.includes('kr')
              ? 'Se saksdokumentene for økonomiske tall.'
              : 'Ikke spesifisert i kortversjonen.',
        });
      }
    }

    fetchSummary();
    return () => {
      cancelled = true;
    };
  }, [sakId, title, summary]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-8 animate-pulse">
        <div className="h-6 bg-indigo-100 dark:bg-indigo-950/50 rounded w-1/3 mb-6"></div>
        {statusMessage && <div className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">{statusMessage}</div>}
        <div className="space-y-4">
          <div className="h-4 bg-indigo-50 dark:bg-indigo-950/40 rounded w-full"></div>
          <div className="h-4 bg-indigo-50 dark:bg-indigo-950/40 rounded w-5/6"></div>
          <div className="h-4 bg-indigo-50 dark:bg-indigo-950/40 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-8 shadow-sm"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center">
          <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mr-2" />
          AI-forklart (nøytral)
        </h2>
        <div className="flex items-center gap-2">
          {data.cached && (
            <span className="text-xs text-muted-foreground hidden sm:inline">Lagret sammendrag</span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <NorwegianFlagIcon className="shrink-0 rounded-[1px] shadow-sm" />
            Generert av AI
          </span>
        </div>
      </div>

      {data.version === 2 ? (
        <V2Summary data={data} />
      ) : (
        <LegacySummary data={data} />
      )}
    </motion.div>
  );
}

function V2Summary({ data }: { data: AiSummaryV2 & { cached?: boolean } }) {
  return (
    <div className="space-y-6">
      {data.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-card border border-indigo-100 dark:border-indigo-900/50 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300"
            >
              <Tag className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>
      )}

      <p className="text-foreground text-sm leading-relaxed">{data.narrative}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-emerald-50 rounded-xl p-5">
          <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold mb-2">
            <Users className="w-5 h-5 mr-2" />
            Hvem berøres?
          </div>
          <p className="text-foreground text-sm leading-relaxed">{data.who_affected}</p>
        </div>
        <div className="bg-violet-50 rounded-xl p-5">
          <div className="flex items-center text-violet-600 dark:text-violet-400 font-semibold mb-2">
            <Sparkles className="w-5 h-5 mr-2" />
            Hvordan berøres de?
          </div>
          <p className="text-foreground text-sm leading-relaxed">{data.how_affected}</p>
        </div>
      </div>

      {data.topic_cards.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.topic_cards.map((card) => (
            <div key={card.title} className="bg-indigo-50 dark:bg-indigo-950/40 rounded-xl p-5">
              <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-semibold mb-2">
                <BrainCircuit className="w-5 h-5 mr-2" />
                {card.title}
              </div>
              <p className="text-foreground text-sm leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegacySummary({ data }: { data: AiSummaryLegacy }) {
  const items = [
    { icon: BrainCircuit, label: 'Hva?', text: data.hva, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
    { icon: Users, label: 'Hvem?', text: data.hvem, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50' },
    { icon: Sparkles, label: 'Kostnad?', text: data.kostnad, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className={`${item.bg} rounded-xl p-5`}>
          <div className={`flex items-center ${item.color} font-semibold mb-2`}>
            <item.icon className="w-5 h-5 mr-2" />
            {item.label}
          </div>
          <p className="text-foreground text-sm leading-relaxed">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
