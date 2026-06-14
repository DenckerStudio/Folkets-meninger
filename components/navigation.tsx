'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingHeader } from '@/components/landing-header';
import { DashboardMobileNav } from '@/components/dashboard-mobile-nav';
import { isDashboardPath, isForumRelatedPath } from '@/lib/routes';

type NavigationProps = {
  children: React.ReactNode;
};

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();
  const isMarketing = pathname === '/' || pathname === '/om-oss';
  const inDashboard = isDashboardPath(pathname);

  return (
    <>
      {isMarketing ? (
        <LandingHeader />
      ) : inDashboard ? (
        <Header />
      ) : null}
      {inDashboard && !isForumRelatedPath(pathname) ? <DashboardMobileNav /> : null}
      <div>{children}</div>
    </>
  );
}
