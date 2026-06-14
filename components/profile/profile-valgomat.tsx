'use client';

import { ValgomatPanel } from '@/components/valgomat-panel';
import { ProfileCard } from '@/components/profile/profile-card';

type ProfileValgomatProps = {
  voteCount: number;
};

export function ProfileValgomat({ voteCount }: ProfileValgomatProps) {
  return (
    <div className="space-y-6">
      <ProfileCard
        title="Valgomat 2.0"
        description={
          voteCount > 0
            ? `Basert på dine ${voteCount} stemmer. Stem på flere saker for bedre nøyaktighet.`
            : 'Stem på saker for å se hvilke partier du er mest enig med.'
        }
      >
        <ValgomatPanel />
      </ProfileCard>
    </div>
  );
}
