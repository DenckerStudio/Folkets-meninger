import type { PollRecord } from '@/lib/polls/types';

const UNIT_LABELS: Record<string, string> = {
  medlemmer: 'medlemmer',
  underskrifter: 'underskrifter',
  deltakere: 'deltakere',
  kroner: 'kroner',
};

function formatScaleDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
}

type ActionScaleLineProps = {
  poll: PollRecord;
  className?: string;
};

export function ActionScaleLine({ poll, className }: ActionScaleLineProps) {
  if (poll.pollKind !== 'aksjon') return null;
  if (poll.scaleValue == null || !poll.scaleUnit) return null;

  const unit = UNIT_LABELS[poll.scaleUnit] ?? poll.scaleUnit;
  const asOf = formatScaleDate(poll.scaleAsOf);
  const sourceHref = poll.scaleSourceUrl || poll.sourceUrl;

  const line = `Ifølge kilde${asOf ? `, ${asOf}` : ''}: ca. ${poll.scaleValue.toLocaleString('nb-NO')} ${unit}`;

  if (sourceHref) {
    return (
      <p className={className}>
        <a
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand underline-offset-2 hover:underline"
        >
          {line}
        </a>
      </p>
    );
  }

  return <p className={className}>{line}</p>;
}
