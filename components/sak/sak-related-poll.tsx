import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PollRecord } from '@/lib/polls/types';
import { isPollVotingOpen } from '@/lib/polls/format';
import { routes } from '@/lib/routes';

export function SakRelatedPoll({ poll }: { poll: PollRecord | null }) {
  if (!poll) return null;
  const open = isPollVotingOpen(poll);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">
          {open ? 'Nasjonal avstemning er åpen' : 'Nasjonal avstemning'}
        </p>
        <p className="text-sm text-muted-foreground">
          {open
            ? 'Si din mening med Ja, Nei eller Blank — ikke på denne sakssiden.'
            : 'Se resultatet av avstemningen knyttet til denne saken.'}
        </p>
      </div>
      <Link
        href={routes.poll(poll.id)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand/90"
      >
        {open ? 'Stem nå' : 'Se resultat'}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
