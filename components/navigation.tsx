'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-3';
import { LandingHeader } from '@/components/landing-header';
import { MobileNav } from '@/components/mobile-nav';
import { MobileTopBar } from '@/components/mobile-top-bar';
import { isDashboardPath } from '@/lib/routes';

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
        <div className="hidden md:block">
          <Header />
        </div>
      ) : null}
      {inDashboard ? (
        <>
          <MobileTopBar />
          <MobileNav />
        </>
      ) : null}
      <div
        className={
          inDashboard ? 'pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0' : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
