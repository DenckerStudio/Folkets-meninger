import Link from 'next/link';
import {
  SYSTEM_POLL_SHARE_RETIRED_LEAD,
  SYSTEM_POLL_SHARE_RETIRED_TITLE,
} from '@/lib/polls/system-reels-retired';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type PollRetiredNoticeProps = {
  /** Dashboard detail uses h1; nested surfaces use h2. */
  headingLevel?: 'h1' | 'h2';
  compact?: boolean;
  showActions?: boolean;
  /** Embed: no inner card chrome (outer embed frame provides border/padding). */
  variant?: 'default' | 'bare';
  /** Open the Utforsk CTA outside the host iframe (embed). */
  linkOpensInNewTab?: boolean;
  className?: string;
};

const linkClassName = cn(
  'inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:opacity-90',
  VURDER_FOCUS_RING,
);

export function PollRetiredNotice({
  headingLevel = 'h1',
  compact = false,
  showActions = true,
  variant = 'default',
  linkOpensInNewTab = false,
  className,
}: PollRetiredNoticeProps) {
  const Heading = headingLevel;
  const bare = variant === 'bare';

  const actionLink = linkOpensInNewTab ? (
    <a href={routes.utforsk} target="_blank" rel="noopener noreferrer" className={linkClassName}>
      Utforsk saker
    </a>
  ) : (
    <Link href={routes.utforsk} className={linkClassName}>
      Utforsk saker
    </Link>
  );

  return (
    <section
      className={cn(
        'space-y-4',
        !bare && 'rounded-3xl border border-border bg-card shadow-sm',
        !bare && (compact ? 'p-4' : 'p-6'),
        className,
      )}
    >
      <Heading
        className={cn(
          'font-bold leading-snug tracking-tight text-foreground',
          compact ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl',
        )}
      >
        {SYSTEM_POLL_SHARE_RETIRED_TITLE}
      </Heading>
      <p className="text-sm leading-relaxed text-muted-foreground">{SYSTEM_POLL_SHARE_RETIRED_LEAD}</p>
      {showActions ? <div className="pt-2">{actionLink}</div> : null}
    </section>
  );
}
