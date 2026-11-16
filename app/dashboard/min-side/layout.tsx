import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { MinSideLayout } from '@/components/min-side/min-side-layout';

export default function MinSideSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardPage className="mx-auto max-w-6xl px-1">
      <MinSideLayout>{children}</MinSideLayout>
    </DashboardPage>
  );
}