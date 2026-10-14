import Link from 'next/link';
import { opinionSupportCount, stanceLabel } from '@/lib/opinions/labels';
import type { IssueOpinionHighlights } from '@/lib/opinions/types';
import type { PollGenerationMetadata } from '@/lib/polls/types';
import { routes } from '@/lib/routes';

/**
 * Top for/imot opinions for the same sak, shown on the Reel vote face so an
 * undecided voter can read the strongest argument on each side (B3).
 */
export function ReelOpinionHighlights({
  issueId,
  opinions,
}: {
  issueId: string;
  opinions: IssueOpinionHighlights | null | undefined;
}) {
  if (!opinions) return null;
  const rows = [opinions.for, opinions.imot].filter((item) => Boolean(item));
  if (rows.length === 0 && opinions.total === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-white/65">Topp meninger</p>
      {rows.map((opinion) =>
        opinion ? (
          <Link
            key={opinion.id}
            href={routes.opinion(opinion.id)}
            className="block rounded-xl bg-white/10 px-3 py-2 transition-colors hover:bg-white/15"
          >
            <span className="text-[11px] font-semibold text-white/70">
              {stanceLabel(opinion.stance)} · {opinionSupportCount(opinion.counts)} støtter
            </span>
            <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-white">
              {opinion.title}
            </span>
          </Link>
        ) : null,
      )}
      <Link
        href={routes.folketsMeningerForSak(issueId)}
        className="inline-flex text-xs font-medium text-white/75 underline-offset-2 hover:underline"
      >
        Se alle {opinions.total} meninger om saken
      </Link>
    </div>
  );
}

/** Marks a Reel draft that an admin opened from a citizen opinion (B6). */
export function ReelSourceBadge({ metadata }: { metadata: PollGenerationMetadata }) {
  if (!metadata.user_initiated) return null;
  return (
    <span className="inline-flex self-start rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
      Brukerinitiert
    </span>
  );
}
