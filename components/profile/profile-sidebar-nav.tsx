'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { PROFILE_TABS, type ProfileTabId } from '@/components/profile/profile-tabs';

type ProfileSidebarNavProps = {
  activeTab: ProfileTabId;
};

export function ProfileSidebarNav({ activeTab }: ProfileSidebarNavProps) {
  const router = useRouter();

  return (
    <nav className="space-y-1" aria-label="Profilseksjoner">
      {PROFILE_TABS.map((tab) => {
        const active = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              router.replace(`${routes.minSide}?tab=${tab.id}`, { scroll: false });
            }}
            className={cn(
              'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
              active
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'w-5 h-5 shrink-0 mt-0.5',
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground',
              )}
            />
            <span className="min-w-0">
              <span className="font-medium block">{tab.label}</span>
              <span className="text-xs text-muted-foreground line-clamp-1">{tab.description}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
