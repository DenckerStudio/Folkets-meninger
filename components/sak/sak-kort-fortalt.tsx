import type { ComponentType } from 'react';
import { CircleDollarSign, HandHeart, Scale, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiSummary } from '@/lib/ai-summary/types';
import { isAiSummaryV2 } from '@/lib/ai-summary/types';
import { sakSummaryReadyFromStored } from '@/lib/ai-summary/sak-summary-fetch';
import { isDisplayableAiSummaryKostnad } from '@/lib/ai-summary/display-kostnad';

function FactBlock({
  icon: Icon,
  label,
  text,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  text: string;
  className?: string;
}) {
  if (!text.trim()) return null;
  return (
    <div className={cn('min-w-0 rounded-xl border border-border bg-muted/20 p-3 sm:p-4', className)}>
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <p className="text-sm leading-relaxed break-words text-foreground">{text}</p>
    </div>
  );
}

export function SakKortFortalt({
  summary,
  vedtakText,
  className,
}: {
  summary: AiSummary | null;
  vedtakText?: string | null;
  className?: string;
}) {
  const ready = sakSummaryReadyFromStored(summary);
  const vedtak = vedtakText?.trim() ?? '';
  const hasVedtak = vedtak.length > 0;

  if (!ready && !hasVedtak) {
    return (
      <section
        className={cn(
          'rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground sm:px-6',
          className,
        )}
        aria-label="Kort fortalt"
      >
        Kort sammendrag er ikke tilgjengelig for denne saken ennå. Du finner offisiell sakstekst under fanen
        Dokumenter.
      </section>
    );
  }

  const narrative = ready
    ? ready.version === 2
      ? ready.narrative.trim()
      : ready.hva.trim()
    : '';

  return (
    <section
      className={cn('rounded-2xl border border-brand/12 bg-card p-4 shadow-sm sm:p-6', className)}
      aria-label="Kort fortalt"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand/80">Kort fortalt</h2>
      {narrative ? (
        <p className="mt-3 text-base leading-relaxed text-pretty text-foreground">{narrative}</p>
      ) : null}

      {ready && isAiSummaryV2(ready) && ready.forslag.length > 0 ? (
        <section className="mt-4 min-w-0 rounded-xl border border-border bg-background/60 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Forslaget
          </h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
            {ready.forslag.map((item, index) => (
              <li key={`${index}-${item.slice(0, 40)}`} className="break-words pl-1">
                {item}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {ready && ready.version === 2 && ready.who_affected.trim() ? (
          <FactBlock icon={Users} label="Hvem berøres?" text={ready.who_affected} />
        ) : null}
        {ready && ready.version === 2 && ready.how_affected.trim() ? (
          <FactBlock icon={HandHeart} label="Hvordan?" text={ready.how_affected} />
        ) : null}
        {ready && ready.version === 1 && ready.hvem.trim() ? (
          <FactBlock icon={Users} label="Hvem berøres?" text={ready.hvem} />
        ) : null}
        {ready &&
        'kostnad' in ready &&
        isDisplayableAiSummaryKostnad(ready.kostnad) &&
        ready.kostnad ? (
          <FactBlock icon={CircleDollarSign} label="Økonomi" text={ready.kostnad} />
        ) : null}
        {hasVedtak ? <FactBlock icon={Scale} label="Vedtak" text={vedtak} className="sm:col-span-2" /> : null}
      </div>
    </section>
  );
}