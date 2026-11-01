import Link from 'next/link';
import {
  SYSTEM_POLL_SHARE_RETIRED_LEAD,
  SYSTEM_POLL_SHARE_RETIRED_TITLE,
} from '@/lib/polls/system-reels-retired';
import { routes } from '@/lib/routes';

export function SharePollRetiredPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight text-brand">Folkets</span>
          <span className="text-lg font-extrabold tracking-tight text-brand-accent">Meninger</span>
        </Link>
      </header>

      <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
          {SYSTEM_POLL_SHARE_RETIRED_TITLE}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{SYSTEM_POLL_SHARE_RETIRED_LEAD}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={routes.avstemninger}
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Gå til avstemninger
          </Link>
          <Link
            href={routes.utforsk}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            Utforsk
          </Link>
        </div>
      </section>
    </div>
  );
}
