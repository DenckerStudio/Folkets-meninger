'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { routes } from '@/lib/routes';
import { ProfileCard } from '@/components/profile/profile-card';

/** Admin entry for mobile profile (desktop uses Mer dropdown). */
export function ProfileAdminLinks() {
  const { user } = useAuth();
  const isAdminUser = useIsAdmin();

  if (!user || !isAdminUser) return null;

  return (
    <ProfileCard title="Admin" description="Verktøy for statistikk og drift." className="md:hidden">
      <Link
        href={routes.admin}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50"
      >
        <Shield className="w-4 h-4 text-muted-foreground" />
        Admin-hub
      </Link>
    </ProfileCard>
  );
}
