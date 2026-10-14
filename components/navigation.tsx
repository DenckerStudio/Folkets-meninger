'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingFooter } from '@/components/landing-footer';
import { LandingHeader } from '@/components/landing-header';
import { DashboardNavProvider } from '@/components/dashboard/dashboard-nav-context';
import { ProfileMenuFloating } from '@/components/profile/profile-menu-floating';
import { MobileNav } from '@/components/mobile-nav';
import { isDashboardPath, isEmbedPath, isPublicProfilePath } from '@/lib/routes';

type NavigationProps = {
  children: React.ReactNode;
};

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();
  if (isEmbedPath(pathname)) {
    return <>{children}</>;
  }
  const isMarketing = pathname === '/' || pathname === '/innspill';
  const inDashboard = isDashboardPath(pathname);
  const showAppHeader = inDashboard || isPublicProfilePath(pathname);

  const content = (
    <>
      {isMarketing ? (
        <LandingHeader />
      ) : showAppHeader ? (
        <Header />
      ) : null}
      <div className={showAppHeader ? 'pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] xl:pb-0' : undefined}>
        {children}
      </div>
      {showAppHeader ? <MobileNav /> : null}
      {isMarketing ? <LandingFooter /> : null}
    </>
  );

  if (inDashboard) {
    return (
      <DashboardNavProvider>
        {content}
        <ProfileMenuFloating />
      </DashboardNavProvider>
    );
  }

  return (
    <>
      {content}
      {showAppHeader ? <ProfileMenuFloating /> : null}
    </>
  );
}
