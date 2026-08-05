import type { Metadata } from 'next';
import { MineInnleggList } from '@/components/forum/mine-innlegg-list';

export const metadata: Metadata = {
  title: 'Mine innlegg | Forum',
  description: 'Dine tråder og svar i Folkets Stemme-forumet.',
};

export default function ForumMineInnleggPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Mine innlegg</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dine tråder og svar i forumet. Innlegg er offentlige og viser ditt navn.
        </p>
      </header>
      <MineInnleggList />
    </div>
  );
}
