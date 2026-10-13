import { Suspense } from 'react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { getPolitikereOversikt } from '@/lib/stortinget';
import { buildPageMetadata } from '@/lib/seo/metadata';
import PolitikereExplorer from './politikere-explorer';

export const dynamic = 'force-dynamic';

export const metadata = buildPageMetadata({
  title: 'Politikere',
  description:
    'Oversikt over stortingsrepresentanter og regjeringsmedlemmer. Se hvem som representerer deg.',
  canonicalPath: '/dashboard/politikere',
});

export default async function PolitikerePage() {
  const politikere = await getPolitikereOversikt();

  return (
    <DashboardPage>
      <FadeIn delay={0.1}>
        <PageHeader
          title="Politikere"
          description="Stortingsrepresentanter og regjeringsmedlemmer. Verifiserte politikere kan svare på saker og se anonymisert statistikk fra velgerne sine."
        />
      </FadeIn>

      <Suspense fallback={null}>
        <PolitikereExplorer politikere={politikere} />
      </Suspense>
    </DashboardPage>
  );
}
