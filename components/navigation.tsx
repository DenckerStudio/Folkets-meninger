'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingHeader } from '@/components/landing-header';
import { isDashboardPath, isPublicProfilePath } from '@/lib/routes';

type NavigationProps = {
  children: React.ReactNode;
};

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();
  const isMarketing = pathname === '/' || pathname === '/om-oss';
  const inDashboard = isDashboardPath(pathname);
  const showAppHeader = inDashboard || isPublicProfilePath(pathname);

  return (
    <>
      {isMarketing ? (
        <LandingHeader />
      ) : showAppHeader ? (
        <Header />
      ) : null}
      <div>{children}</div>
    </>
  );
}
