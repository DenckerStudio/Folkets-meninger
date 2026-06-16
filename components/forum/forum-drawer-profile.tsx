'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, LogOut, Settings, SlidersHorizontal, UserCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

type ForumDrawerProfileProps = {
  onNavigate?: () => void;
  className?: string;
};

function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ForumDrawerProfile({ onNavigate, className }: ForumDrawerProfileProps) {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const displayName =
    user.user_metadata?.full_name || user.email?.split('@')[0] || 'Min konto';
  const initials = initialsFromDisplayName(displayName || user.email || 'FS');

  const handleSignOut = async () => {
    const { getBrowserSupabase } = await import('@/lib/supabase');
    await getBrowserSupabase().auth.signOut();
    onNavigate?.();
    router.push(routes.home);
    router.refresh();
  };

  return (
    <div className={cn('mt-5 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm xl:hidden', className)}>
      <div className="mb-3 flex items-center gap-3 px-3 py-1">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#00205b] text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="truncate text-xs text-gray-500">{user.email}</p>
        </div>
      </div>
      <nav className="space-y-0.5" aria-label="Profil">
        <DrawerProfileLink href={routes.minSide} icon={UserCircle} label="Min side" onNavigate={onNavigate} />
        <DrawerProfileLink href={routes.profile(user.id)} icon={Eye} label="Offentlig profil" onNavigate={onNavigate} />
        <DrawerProfileLink
          href={`${routes.minSide}?tab=offentlig`}
          icon={Settings}
          label="Profilinnstillinger"
          onNavigate={onNavigate}
        />
        <DrawerProfileLink
          href={`${routes.minSide}?tab=varsler`}
          icon={SlidersHorizontal}
          label="Preferanser"
          onNavigate={onNavigate}
        />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logg ut
        </button>
      </nav>
    </div>
  );
}

function DrawerProfileLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon className="h-5 w-5 shrink-0" />
      {label}
    </Link>
  );
}
