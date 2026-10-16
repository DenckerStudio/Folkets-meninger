'use client';

import type { User } from '@supabase/supabase-js';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { cn } from '@/lib/utils';

type ProfileMenuAvatarTriggerProps = {
  user: User;
  className?: string;
};

/** Compact circular trigger for the site header (desktop). */
export function ProfileMenuAvatarTrigger({ user, className }: ProfileMenuAvatarTriggerProps) {
  return (
    <span
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-full ring-offset-background transition-shadow hover:ring-2 hover:ring-brand/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <ProfileAvatar user={user} size="md" className="h-10 w-10 text-sm" />
    </span>
  );
}
