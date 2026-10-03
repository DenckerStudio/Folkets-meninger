import { StemmePlusAdmin } from '@/components/admin/stemme-plus-admin';
import { DashboardPage } from '@/components/dashboard/dashboard-page';

export const dynamic = 'force-dynamic';

export default function AdminStemmePlusPage() {
  return (
    <DashboardPage>
      <StemmePlusAdmin />
    </DashboardPage>
  );
}
