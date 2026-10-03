import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  LayoutDashboard,
  Lightbulb,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { routes } from '@/lib/routes';

export type AdminNavItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon: LucideIcon;
  status: 'active' | 'coming';
};

export const adminNavItems: AdminNavItem[] = [
  {
    id: 'forslag',
    title: 'Forslag',
    description: 'Innkommende forslag fra innloggede brukere',
    href: routes.adminForslag,
    icon: Lightbulb,
    status: 'active',
  },
  {
    id: 'reels',
    title: 'Reels',
    description: 'Systemgenererte avstemninger fra stortingssaker',
    href: routes.adminReels,
    icon: Sparkles,
    status: 'active',
  },
  {
    id: 'statistikk',
    title: 'Statistikk',
    description: 'Anonyme stemmetall og CSV-eksport',
    href: routes.adminStats,
    icon: BarChart3,
    status: 'active',
  },
  {
    id: 'brukere',
    title: 'Brukere',
    description: 'Roller og tilganger for administratorer',
    href: routes.adminBrukere,
    icon: Users,
    status: 'active',
  },
  {
    id: 'stemme-plus',
    title: 'Stemme+',
    description: 'Manuell tildeling av støttemedlemskap',
    href: routes.adminStemmePlus,
    icon: Star,
    status: 'active',
  },
  {
    id: 'varsler',
    title: 'Varsler',
    description: 'Utsendelser og varsling til brukere',
    icon: Bell,
    status: 'coming',
  },
];

export const adminHubNavItem: AdminNavItem = {
  id: 'oversikt',
  title: 'Oversikt',
  description: 'Admin-hub og verktøy',
  href: routes.admin,
  icon: LayoutDashboard,
  status: 'active',
};

export function isAdminPath(pathname: string): boolean {
  return pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);
}

export function adminNavIsActive(pathname: string, href: string): boolean {
  if (href === routes.admin) {
    return pathname === routes.admin;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
