'use client';

import type { User } from '@supabase/supabase-js';
import { getProfileAvatarUrl, getProfileInitials } from '@/lib/profile/user-display';
import { cn } from '@/lib/utils';

type ProfileAvatarProps = {
  user: User;
  className?: string;
  size?: 'sm' | 'md';
};

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-11 w-11 text-base',
};

export function ProfileAvatar({ user, className, size = 'sm' }: ProfileAvatarProps) {
  const avatarUrl = getProfileAvatarUrl(user);
  const initials = getProfileInitials(user);

  if (avatarUrl) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-full border border-border bg-muted',
          sizeClasses[size],
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URLs vary by provider */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-brand font-semibold text-brand-foreground',
        sizeClasses[size],
        className,
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}
