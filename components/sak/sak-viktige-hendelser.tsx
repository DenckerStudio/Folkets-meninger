import { Clock } from 'lucide-react';
import type { SakViktigHendelse } from '@/lib/sak/stortinget-public-status';

type SakViktigeHendelserProps = {
  events: SakViktigHendelse[];
};

export function SakViktigeHendelser({ events }: SakViktigeHendelserProps) {
  if (events.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="sak-viktige-hendelser-heading"
    >
      <h2
        id="sak-viktige-hendelser-heading"
        className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg"
      >
        <Clock className="h-5 w-5 text-brand" aria-hidden />
        Viktige hendelser
      </h2>
      <ol className="mt-4 space-y-3 border-l border-border pl-4">
        {events.map((event) => (
          <li key={`${event.id}-${event.dateIso ?? 'nd'}`} className="relative">
            <span
              className="absolute -left-[1.125rem] top-1.5 h-2 w-2 rounded-full bg-brand"
              aria-hidden
            />
            <p className="text-sm font-medium text-foreground">{event.label}</p>
            {event.dateLabel ? (
              <time
                dateTime={event.dateIso ?? undefined}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {event.dateLabel}
              </time>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}