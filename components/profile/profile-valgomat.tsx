'use client';

import Link from 'next/link';
import { ValgomatPanel } from '@/components/valgomat-panel';
import { ProfileCard } from '@/components/profile/profile-card';
import { routes } from '@/lib/routes';

type ProfileValgomatProps = {
  stanceCount: number;
};

export function ProfileValgomat({ stanceCount }: ProfileValgomatProps) {
  return (
    <div className="space-y-6">
      <ProfileCard
        title="Valgomat 2.0"
        description={
          stanceCount > 0
            ? `Basert på ${stanceCount} holdninger (enig/uenig). Marker flere for bedre nøyaktighet.`
            : 'Marker holdning på saker for å se hvilke partier du er mest enig med.'
        }
      >
        <ValgomatPanel />
        <Link
          href={routes.valgomat}
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Se full valgomat-side →
        </Link>
      </ProfileCard>
    </div>
  );
}
