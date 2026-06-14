'use client';

import { LogOut, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';

type ProfileHeroProps = {
  user: User;
  voteCount: number;
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

export function ProfileHero({ user, voteCount, onSignOut }: ProfileHeroProps) {
  const displayName =
    (user.user_metadata?.full_name as string | undefined) || user.email || 'Bruker';

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-[#00205b]/5 via-white to-[#ba0c2f]/5 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              'bg-[#00205b] text-lg font-bold text-white shadow-md',
            )}
            aria-hidden
          >
            {initialsFromUser(user)}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">Min profil</h1>
            <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1 truncate">
              <Shield className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">{displayName}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center justify-center gap-2 self-start sm:self-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logg ut
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-md">
        <div className="rounded-xl bg-white/80 border border-gray-100 px-4 py-3">
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stemmer</dt>
          <dd className="text-2xl font-bold text-[#00205b] mt-0.5">{voteCount}</dd>
        </div>
      </dl>
    </div>
  );
}
