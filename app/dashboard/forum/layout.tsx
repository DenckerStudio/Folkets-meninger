import { Suspense } from 'react';
import ForumSidebar from '@/components/forum/forum-sidebar';
import ForumMobileNav from '@/components/forum/forum-mobile-nav';
import { ForumMobileRules } from '@/components/forum/forum-mobile-rules';

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[1280px] mx-auto px-4 py-6">
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
        <div className="min-w-0">
          <ForumMobileRules />
          {children}
        </div>
      </div>
    </div>
  );
}
