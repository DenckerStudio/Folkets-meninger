import type { LucideIcon } from 'lucide-react';
import { BarChart2, Flag, Sparkles } from 'lucide-react';
import { routes } from '@/lib/routes';
import type { NavIsActive } from '@/lib/site-nav-links';

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: NavIsActive;
};

export const isAdminForumPromptsActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.adminForumPrompts) ||
  pathname.startsWith(routes.adminForumClusters);

export const isAdminForumReportsActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.adminForumReports);

export const isAdminStatsActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.adminStats);

export const adminNavLinks: AdminNavLink[] = [
  {
    href: routes.adminForumReports,
    label: 'Rapporter',
    icon: Flag,
    isActive: isAdminForumReportsActive,
  },
  {
    href: routes.adminStats,
    label: 'Statistikk',
    icon: BarChart2,
    isActive: isAdminStatsActive,
  },
  {
    href: `${routes.adminForumPrompts}?tab=pipeline`,
    label: 'Forum Reels',
    icon: Sparkles,
    isActive: isAdminForumPromptsActive,
  },
];
