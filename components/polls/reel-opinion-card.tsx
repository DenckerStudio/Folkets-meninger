import Link from 'next/link';
import { stanceLabel } from '@/lib/opinions/labels';
import type { OpinionListItem } from '@/lib/opinions/types';
import { routes } from '@/lib/routes';

/**
 * A citizen opinion rendered as a Reel slide (B7). Same card format as the
 * vote cards, with the lead point and Enig/Uenig buttons that link into the
 * opinion thread (where the supported For/Blank/Imot reply flow lives).
 */
export function ReelOpinionCard({ opinion }: { opinion: OpinionListItem }) {
  const leadPoint = opinion.points[0]?.text ?? opinion.body;

  return (
    <div className="flex h-full flex-col justify-between gap-3 bg-gradient-to-b from-[#20233f] to-[#0b0d1c] p-5 text-white">
      <span className="inline-flex self-start rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
        Mening · {stanceLabel(opinion.stance)}
      </span>

      <div className="space-y-2">
        {opinion.issueTitle ? (
          <p className="line-clamp-1 text-[11px] font-medium uppercase tracking-wide text-white/60">
            {opinion.issueTitle}
          </p>
        ) : null}
        <h3 className="text-lg font-semibold leading-snug sm:text-xl">{opinion.title}</h3>
        {leadPoint ? (
          <p className="line-clamp-4 text-sm leading-relaxed text-white/75">{leadPoint}</p>
        ) : null}
        <p className="text-xs text-white/60">
          {opinion.counts.total} støtter · {opinion.authorName ?? 'En innbygger'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={routes.opinion(opinion.id)}
          className="rounded-xl bg-[#0a3d9e] px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#0c4ab8]"
        >
          Enig
        </Link>
        <Link
          href={routes.opinion(opinion.id)}
          className="rounded-xl bg-[#ba0c2f] px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#ba0c2f]/90"
        >
          Uenig
        </Link>
      </div>
    </div>
  );
}
