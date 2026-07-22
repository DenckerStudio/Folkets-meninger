'use client';

import { ValgomatPanel } from '@/components/valgomat-panel';
import { ProfileCard } from '@/components/profile/profile-card';
import type { ForumVoteHistorySummary } from '@/lib/forum/vote-history';

type ProfileValgomatProps = {
  summary: ForumVoteHistorySummary;
};

export function ProfileValgomat({ summary }: ProfileValgomatProps) {
  return (
    <div className="space-y-6">
      <ProfileCard
        title="Valgomat 2.0"
        description={
          summary.total > 0
            ? `Basert på ${summary.total} ja/nei-svar i forumet. Svar på flere avstemninger for et tydeligere bilde.`
            : 'Svar på ja/nei-avstemninger i forumet for å se engasjement og stemmemønster.'
        }
      >
        <ValgomatPanel />
      </ProfileCard>
    </div>
  );
}
