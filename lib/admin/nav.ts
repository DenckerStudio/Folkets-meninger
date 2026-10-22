import type { ComponentType } from 'react';
import {
  BarChart3,
  Bell,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  Radar,
  Users,
} from 'lucide-react';
import { CivicBubble, CivicHeart } from '@/components/icons/civic';
import { routes } from '@/lib/routes';

export type AdminNavItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  icon: ComponentType<{ className?: string }>;
  status: 'active' | 'coming';
};

export const adminNavItems: AdminNavItem[] = [
  {
    id: 'appens-fremtid',
    title: 'Appens fremtid',
    description: 'Forslag, endringslogg og veikart',
    href: routes.adminForslag,
    icon: Lightbulb,
    status: 'active',
  },
  {
    id: 'research',
    title: 'Research',
    description: 'Saker og aksjoner vi har fanget opp, med kilder',
    href: routes.adminResearch,
    icon: Radar,
    status: 'active',
  },
  {
    id: 'reels',
    title: 'Reels',
    description: 'Generering og kø for systemutkast',
    href: routes.adminReels,
    icon: CivicBubble,
    status: 'active',
  },
  {
    id: 'vurder',
    title: 'Vurder',
    description: 'Reels, blogginnlegg og sammendrag',
    href: routes.adminVurder,
    icon: ClipboardCheck,
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
    icon: CivicHeart,
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
