'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';
import { DashboardNavProvider } from '@/components/dashboard/dashboard-nav-context';
import { isDashboardPath, isPublicProfilePath } from '@/lib/routes';

type NavigationProps = {
  children: React.ReactNode;
};

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();
  const isMarketing =
    pathname === '/' || pathname === '/om-oss' || pathname === '/innspill';
  const inDashboard = isDashboardPath(pathname);
  const showAppHeader = inDashboard || isPublicProfilePath(pathname);

  const content = (
    <>
      {isMarketing ? (
        <LandingHeader />
      ) : showAppHeader ? (
        <Header />
      ) : null}
      <div>{children}</div>
      {isMarketing ? <LandingFooter /> : null}
    </>
  );

  if (inDashboard) {
    return <DashboardNavProvider>{content}</DashboardNavProvider>;
  }

  return content;
}
