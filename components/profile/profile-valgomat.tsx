'use client';

import { ValgomatPanel } from '@/components/valgomat-panel';
import { ProfileCard } from '@/components/profile/profile-card';

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
      </ProfileCard>
    </div>
  );
}
