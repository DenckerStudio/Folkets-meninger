import { Suspense } from 'react';
import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { MinSideLayout } from '@/components/min-side/min-side-layout';
import { MinSideLegacyTabRedirect } from '@/components/min-side/min-side-legacy-tab-redirect';

export default function MinSideSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardPage className="mx-auto max-w-6xl px-1">
      <Suspense fallback={null}>
        <MinSideLegacyTabRedirect />
      </Suspense>
      <MinSideLayout>{children}</MinSideLayout>
    </DashboardPage>
  );
}