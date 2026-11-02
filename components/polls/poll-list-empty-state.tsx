import Link from 'next/link';
import { Vote } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { pollBallotSlugPhrase } from '@/lib/polls/ballot-buttons';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

/** Shared min-height so Avstemninger and Utforsk poll empties align without layout jump. */
export const POLL_LIST_EMPTY_SHELL_CLASS = 'min-h-[320px] flex flex-col justify-center';

type PollListEmptyStateProps = {
  className?: string;
};

export function PollListEmptyState({ className }: PollListEmptyStateProps) {
  return (
    <div className={cn(POLL_LIST_EMPTY_SHELL_CLASS, className)}>
      <EmptyState
        icon={<Vote className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} aria-hidden />}
        title="Ingen avstemninger er publisert ennå"
        description={`Nasjonale ${pollBallotSlugPhrase()}-avstemninger vises her når en mening i Folkets meninger får nok popularitet. Inntil da kan du lese saker under Utforsk.`}
        action={
          <Link
            href={routes.utforsk}
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90',
              VURDER_FOCUS_RING,
            )}
          >
            Utforsk saker
          </Link>
        }
      />
    </div>
  );
}
