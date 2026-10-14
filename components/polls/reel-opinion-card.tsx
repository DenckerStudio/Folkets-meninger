'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { opinionSupportCount, stanceLabel } from '@/lib/opinions/labels';
import type { OpinionListItem, OpinionStanceCounts } from '@/lib/opinions/types';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';

function buildLoginRedirectUrl(pollId: string | null | undefined, opinionId: string, stance: 'for' | 'imot'): string {
  const pollParam = pollId ? `poll=${encodeURIComponent(pollId)}&` : '';
  const nextUrl = `${routes.utforsk}?${pollParam}quickStance=${encodeURIComponent(`${opinionId}:${stance}`)}#reels`;
  return `${routes.login}?next=${encodeURIComponent(nextUrl)}`;
}

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
  currentPollId,
}: { opinion: OpinionListItem; mode?: 'coverflow' | 'stories'; currentPollId?: string | null }) {
  const leadPoint = opinion.points[0]?.text ?? opinion.body;
  const isStories = mode === 'stories';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  const initialStance = opinion.viewerStance === 'for' || opinion.viewerStance === 'imot' ? opinion.viewerStance : null;
  const [selectedStance, setSelectedStance] = useState<'for' | 'imot' | null>(initialStance);
  const [localCounts, setLocalCounts] = useState<OpinionStanceCounts>(opinion.counts);
  const [error, setError] = useState<string | null>(null);

  // Handle quickStance deep link: auto-POST the stance once on mount
  useEffect(() => {
    const quickStanceParam = searchParams?.get('quickStance');
    if (!quickStanceParam) return;

    const [opinionId, stance] = quickStanceParam.split(':');
    if (opinionId !== opinion.id) return;
    if (stance !== 'for' && stance !== 'imot') return;
    if (selectedStance) return; // Already have a stance

    const saved = sessionStorage.getItem(`quickStancePosted:${opinionId}:${stance}`);
    if (saved) return; // Already posted this session

    if (authLoading) return; // Wait for auth to resolve
    if (!user) {
      // Not logged in: redirect to login with deep link
      const redirectUrl = buildLoginRedirectUrl(currentPollId ?? opinion.pollId, opinionId, stance as 'for' | 'imot');
      window.location.assign(redirectUrl);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/opinions/${opinion.id}/stance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stance, body: '', quick: true }),
        });
        const data = (await res.json()) as { error?: string; replyId?: string; code?: string };
        if (!res.ok) {
          if (data.code === 'quick_stance_db_unsupported') {
            setError('Rask stemme er midlertidig utilgjengelig. Prøv å skrive en begrunnelse i stedet.');
            return;
          }
          throw new Error(data.error || 'Kunne ikke lagre stemme');
        }
        // Optimistic update
        setSelectedStance(stance);
        setLocalCounts((prev) => ({
          ...prev,
          [stance]: prev[stance] + 1,
          total: prev.total + 1,
        }));
        sessionStorage.setItem(`quickStancePosted:${opinionId}:${stance}`, '1');
        // Strip the quickStance param from URL
        const params = new URLSearchParams(window.location.search);
        params.delete('quickStance');
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ''}${window.location.hash}`;
        router.replace(newUrl);
      } catch {
        setError('En feil oppstod. Prøv igjen.');
      }
    });
  }, [opinion.id, searchParams, router, selectedStance, startTransition, authLoading, user, currentPollId]);

  const handleQuickStance = async (stance: 'for' | 'imot') => {
    const isToggleOff = selectedStance === stance;
    setError(null);
    
    if (authLoading) return;
    if (!user) {
      const redirectUrl = buildLoginRedirectUrl(currentPollId ?? opinion.pollId, opinion.id, stance);
      window.location.assign(redirectUrl);
      return;
    }

    startTransition(async () => {
      try {
        if (isToggleOff) {
          // DELETE: remove the viewer's quick stance (only if body is empty)
          const res = await fetch(`/api/opinions/${opinion.id}/stance`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = (await res.json()) as {
            error?: string;
            removed?: boolean;
            keptReply?: boolean;
          };
          if (!res.ok) {
            if (res.status === 401) {
              const redirectUrl = buildLoginRedirectUrl(currentPollId ?? opinion.pollId, opinion.id, stance);
              window.location.assign(redirectUrl);
              return;
            }
            throw new Error(data.error || 'Kunne ikke fjerne stemme');
          }
          setSelectedStance(null);
          // A written reply on the same item is kept (and still counts); an
          // already-removed stance is a no-op. Only decrement when removed.
          if (data.removed === false) return;
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
          const data = (await res.json()) as {
            error?: string;
            replyId?: string;
            code?: string;
            keptReply?: boolean;
          };
          if (!res.ok) {
            if (res.status === 401) {
              const redirectUrl = buildLoginRedirectUrl(currentPollId ?? opinion.pollId, opinion.id, stance);
              window.location.assign(redirectUrl);
              return;
            }
            if (data.code === 'quick_stance_db_unsupported') {
              setError('Rask stemme er midlertidig utilgjengelig. Prøv å skrive en begrunnelse i stedet.');
              return;
            }
            throw new Error(data.error || 'Kunne ikke lagre stemme');
          }
          if (data.keptReply) {
            // The viewer already wrote a reply here; a tap must not replace it.
            setError('Du har allerede skrevet et svar her. Endre det på meningssiden.');
            return;
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

  const stanceButtonClass = (baseStance: 'for' | 'imot') =>
    cn(
      'rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-colors',
      selectedStance === baseStance
        ? baseStance === 'for'
          ? 'bg-[#0a3d9e] text-white ring-2 ring-white ring-offset-2 ring-offset-[#0b0d1c]'
          : 'bg-[#ba0c2f] text-white ring-2 ring-white ring-offset-2 ring-offset-[#0b0d1c]'
        : selectedStance
        ? 'bg-white/10 text-white/70 hover:bg-white/20'
        : baseStance === 'for'
        ? 'bg-[#0a3d9e] hover:bg-[#0c4ab8] text-white'
        : 'bg-[#ba0c2f] hover:bg-[#ba0c2f]/90 text-white',
    );

  const stanceButtonContent = (baseStance: 'for' | 'imot') => (
    <span className="flex items-center justify-center gap-1.5">
      {selectedStance === baseStance && <Check className="h-4 w-4" aria-hidden />}
      {baseStance === 'for' && 'Enig'}
      {baseStance === 'imot' && 'Uenig'}
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

      <div className="grid grid-cols-2 gap-2">
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