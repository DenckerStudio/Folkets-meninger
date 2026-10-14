'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { opinionSupportCount, stanceLabel } from '@/lib/opinions/labels';
import type { OpinionListItem, OpinionStanceCounts } from '@/lib/opinions/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * A citizen opinion rendered as a Reel slide (B7). Same card format as the
 * vote cards, with the lead point and Enig/Uenig buttons that record a quick
 * stance (For/Imot) directly via POST /api/opinions/{id}/stance with an empty
 * body. A secondary "Skriv begrunnelse" link opens the opinion page for a
 * full reply.
 *
 * In 'stories' mode the card is content-driven (max-h-full overflow-y-auto) so
 * vote buttons stay reachable on short viewports. In 'coverflow' mode it uses
 * h-full flex-col justify-between to fill the fixed-height coverflow card.
 */
export function ReelOpinionCard({
  opinion,
  mode = 'coverflow',
}: { opinion: OpinionListItem; mode?: 'coverflow' | 'stories' }) {
  const leadPoint = opinion.points[0]?.text ?? opinion.body;
  const isStories = mode === 'stories';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStance, setSelectedStance] = useState<'for' | 'imot' | 'blank' | null>(
    opinion.viewerStance ?? null,
  );
  const [localCounts, setLocalCounts] = useState<OpinionStanceCounts>(opinion.counts);
  const [error, setError] = useState<string | null>(null);

  const handleQuickStance = async (stance: 'for' | 'imot' | 'blank') => {
    const isToggleOff = selectedStance === stance;
    setError(null);
    startTransition(async () => {
      try {
        if (isToggleOff) {
          // DELETE: remove the viewer's quick stance (only if body is empty)
          const res = await fetch(`/api/opinions/${opinion.id}/stance`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            throw new Error(data.error || 'Kunne ikke fjerne stemme');
          }
          // Optimistic update: decrement the count
          setSelectedStance(null);
          setLocalCounts((prev) => ({
            ...prev,
            [stance]: Math.max(0, prev[stance] - 1),
            total: Math.max(0, prev.total - 1),
          }));
        } else {
          // POST: save or update stance
          const res = await fetch(`/api/opinions/${opinion.id}/stance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stance, body: '', quick: true }),
          });
          const data = (await res.json()) as { error?: string; replyId?: string };
          if (!res.ok) {
            if (res.status === 401) {
              router.push(
                `${routes.login}?next=${encodeURIComponent(routes.opinion(opinion.id, { stance }))}`,
              );
              return;
            }
            throw new Error(data.error || 'Kunne ikke lagre stemme');
          }
          // Optimistic update: handle switching between stances
          setLocalCounts((prev) => {
            const next = { ...prev };
            if (selectedStance && selectedStance !== stance) {
              // Switching from one stance to another: decrement old, increment new
              next[selectedStance] = Math.max(0, next[selectedStance] - 1);
            } else if (!selectedStance) {
              // New stance: increment total
              next.total = next.total + 1;
            }
            // Increment new stance
            next[stance] = next[stance] + 1;
            return next;
          });
          setSelectedStance(stance);
        }
      } catch {
        setError('En feil oppstod. Prøv igjen.');
      }
    });
  };

  const stanceButtonClass = (baseStance: 'for' | 'imot' | 'blank') =>
    cn(
      'rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-colors',
      selectedStance === baseStance
        ? 'opacity-100 ring-2 ring-white bg-inherit text-white'
        : baseStance === 'for'
        ? 'bg-[#0a3d9e] hover:bg-[#0c4ab8] text-white'
        : baseStance === 'imot'
        ? 'bg-[#ba0c2f] hover:bg-[#ba0c2f]/90 text-white'
        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
    );

  const stanceButtonContent = (baseStance: 'for' | 'imot' | 'blank') => (
    <span className="flex items-center justify-center gap-1.5">
      {selectedStance === baseStance && <Check className="h-4 w-4" aria-hidden />}
      {baseStance === 'for' && 'Enig'}
      {baseStance === 'imot' && 'Uenig'}
      {baseStance === 'blank' && 'Blank'}
    </span>
  );

  return (
    <div
      className={`
        flex flex-col gap-3 bg-gradient-to-b from-[#20233f] to-[#0b0d1c] p-5 text-white
        ${isStories ? 'max-h-full min-h-0 overflow-y-auto overscroll-contain' : 'h-full justify-between'}
      `}
    >
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
          {opinionSupportCount(localCounts)} støtter · {opinion.authorName ?? 'En innbygger'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleQuickStance('for')}
          className={stanceButtonClass('for')}
          aria-pressed={selectedStance === 'for'}
        >
          {stanceButtonContent('for')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleQuickStance('blank')}
          className={stanceButtonClass('blank')}
          aria-pressed={selectedStance === 'blank'}
        >
          {stanceButtonContent('blank')}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleQuickStance('imot')}
          className={stanceButtonClass('imot')}
          aria-pressed={selectedStance === 'imot'}
        >
          {stanceButtonContent('imot')}
        </button>
      </div>

      {selectedStance ? (
        <div className="flex justify-center">
          <a
            href={routes.opinion(opinion.id, { stance: selectedStance })}
            className="text-xs text-white/70 underline hover:text-white"
          >
            Skriv begrunnelse…
          </a>
        </div>
      ) : error ? (
        <p className="text-center text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}