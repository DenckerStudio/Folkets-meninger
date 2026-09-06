'use client';

import { LogOut, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { KnowledgeBadges } from '@/components/profile/knowledge-badges';
import { StemmePlusBadge } from '@/components/profile/stemme-plus-badge';
import { PointsProgress } from '@/components/profile/points-progress';
import type { EarnedBadge } from '@/lib/knowledge/types';
import type { UserPointsProgress } from '@/lib/user-points-levels';
import { cn } from '@/lib/utils';

type ProfileHeroProps = {
  user: User;
  voteCount: number;
  points?: number;
  pointsProgress?: UserPointsProgress | null;
  badges?: EarnedBadge[];
  isStemmePlus?: boolean;
  onSignOut: () => void;
};

function initialsFromUser(user: User): string {
  const full = (user.user_metadata?.full_name as string | undefined)?.trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return full.slice(0, 2).toUpperCase();
  }
  const email = user.email ?? '';
  return email.slice(0, 2).toUpperCase() || '?';
}

export function ProfileHero({
  user,
  voteCount,
  points = 0,
  pointsProgress = null,
  badges = [],
  isStemmePlus = false,
  onSignOut,
}: ProfileHeroProps) {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) || user.email || 'Bruker';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
                'bg-brand text-lg font-bold text-white',
              )}
              aria-hidden
            >
              {initialsFromUser(user)}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">Min profil</h1>
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 truncate flex-wrap">
                <span className="inline-flex items-center gap-1 truncate">
                  <Shield className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate">{displayName}</span>
                </span>
                {isStemmePlus ? <StemmePlusBadge /> : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 self-start sm:self-center px-4 py-2 border border-border rounded-xl text-sm font-medium text-foreground bg-card hover:bg-muted/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logg ut
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stemmer avgitt</p>
            <p className="text-2xl font-bold text-brand mt-0.5">{voteCount}</p>
          </div>
          <PointsProgress points={points} progress={pointsProgress} />
        </div>
        <div className="mt-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Kunnskapsmerker</h2>
          <KnowledgeBadges earned={badges} />
        </div>
      </div>
    </div>
  );
}
