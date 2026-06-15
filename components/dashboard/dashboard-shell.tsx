import { Suspense } from 'react';
import ForumSidebar from '@/components/forum/forum-sidebar';
import ForumMobileNav from '@/components/forum/forum-mobile-nav';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 lg:py-4">
      <Suspense fallback={null}>
        <ForumMobileNav />
      </Suspense>
      <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <Suspense fallback={<div className="h-48 animate-pulse bg-gray-100 rounded-xl" />}>
              <ForumSidebar />
            </Suspense>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
