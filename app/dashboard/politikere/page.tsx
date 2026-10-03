import { Suspense } from 'react';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { getPolitikereOversikt } from '@/lib/stortinget';
import PolitikereExplorer from './politikere-explorer';

export const dynamic = 'force-dynamic';

export default async function PolitikerePage() {
  const politikere = await getPolitikereOversikt();

  return (
    <div className="space-y-8 pb-12">
      <FadeIn delay={0.1}>
        <PageHeader
          title="Politikere"
          description="Her finner du oversikt over stortingsrepresentanter og regjeringsmedlemmer. Verifiserte politikere kan svare direkte på saker og se anonymisert statistikk fra sine velgere."
        />
      </FadeIn>

      <Suspense fallback={null}>
        <PolitikereExplorer politikere={politikere} />
      </Suspense>
    </div>
  );
}
