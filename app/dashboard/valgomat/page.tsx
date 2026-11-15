import { ValgomatClient } from '@/components/valgomat/valgomat-client';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

export default function ValgomatPage() {
  return (
    <DashboardPage className="mx-auto max-w-3xl">
      <PageHeader
        title="Valgomat"
        description="Hjertesaker og sammenligning med partivoteringer basert på dine holdninger."
      />
      <ValgomatClient />
    </DashboardPage>
  );
}