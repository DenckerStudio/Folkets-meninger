'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingHeader } from '@/components/landing-header';
import { MobileNav } from '@/components/mobile-nav';
import { DashboardNavProvider } from '@/components/dashboard/dashboard-nav-context';
import { cn } from '@/lib/utils';
import { isDashboardPath, isPublicProfilePath } from '@/lib/routes';

type NavigationProps = {
  children: React.ReactNode;
};

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();
  const isMarketing = pathname === '/' || pathname === '/om-oss';
  const inDashboard = isDashboardPath(pathname);
  const showAppHeader = inDashboard || isPublicProfilePath(pathname);

  const content = (
    <>
      {isMarketing ? (
        <LandingHeader />
      ) : showAppHeader ? (
        <Header />
      ) : null}
      <div
        className={cn(
          inDashboard &&
            'pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] xl:pb-0',
        )}
      >
        {children}
      </div>
      {inDashboard ? <MobileNav /> : null}
    </>
  );

  if (inDashboard) {
    return <DashboardNavProvider>{content}</DashboardNavProvider>;
  }

  return content;
}
