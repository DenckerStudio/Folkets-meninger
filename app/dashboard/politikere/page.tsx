import { DashboardPage } from '@/components/dashboard/dashboard-page';
import FadeIn from '@/components/fade-in';
import { PageHeader } from '@/components/page-header';
import { getPolitikereOversikt } from '@/lib/stortinget';
import PolitikereExplorer from './politikere-explorer';

export const dynamic = 'force-dynamic';

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

      <PolitikereExplorer politikere={politikere} />
    </DashboardPage>
  );
}
