'use client';

import type { User } from '@supabase/supabase-js';
import { ChevronRight } from 'lucide-react';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { getProfileDisplayName } from '@/lib/profile/user-display';
import { cn } from '@/lib/utils';

type ProfileMenuAccountTriggerProps = {
  user: User;
  className?: string;
};

export function ProfileMenuAccountTrigger({ user, className }: ProfileMenuAccountTriggerProps) {
  const displayName = getProfileDisplayName(user);
  const email = user.email ?? '';

  return (
    <span
      className={cn(
        'flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/50',
        className,
      )}
    >
      <ProfileAvatar user={user} size="md" />
      <span className="min-w-0 flex-1">
        {displayName ? (
          <>
            <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
            {email ? (
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            ) : null}
          </>
        ) : (
          <span className="block truncate text-sm font-medium text-foreground">{email || 'Min konto'}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </span>
  );
}
