import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Calendar,
  FileEdit,
  Lightbulb,
  Search,
  UserRound,
  Users,
  Vote,
} from 'lucide-react';
import { DASHBOARD_PREFIX, routes } from '@/lib/routes';

export type NavIsActive = (pathname: string) => boolean;

export type SiteNavLinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  isActive?: NavIsActive;
};

export type PrimaryNavLink = {
  label: string;
  href: string;
  isActive: NavIsActive;
};

export const isUtforskActive: NavIsActive = (pathname) =>
  pathname === routes.utforsk ||
  pathname.startsWith(`${routes.utforsk}/`) ||
  pathname.startsWith(`${DASHBOARD_PREFIX}/sak/`);

export const isPolitikereActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.politikere) || pathname.startsWith(routes.representanter);

export const isAvstemningerActive: NavIsActive = (pathname) =>
  pathname === routes.avstemninger || pathname.startsWith(`${routes.avstemninger}/`);

export const isInitiativActive: NavIsActive = (pathname) =>
  pathname === routes.initiativ || pathname.startsWith(`${routes.initiativ}/`);

export const isHoringerActive: NavIsActive = (pathname) =>
  pathname === routes.horinger || pathname.startsWith(`${routes.horinger}/`);

export const isForslagActive: NavIsActive = (pathname) =>
  pathname === routes.forslag || pathname.startsWith(`${routes.forslag}/`);

export const isKalenderActive: NavIsActive = (pathname) =>
  pathname === routes.kalender || pathname.startsWith(`${routes.kalender}/`);

export const isMinSideActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.minSide) ||
  pathname.startsWith(routes.varsler) ||
  pathname.startsWith('/auth');

export const isOmOssActive: NavIsActive = (pathname) =>
  pathname === '/' || pathname === routes.home;

export const isInnsiktActive: NavIsActive = (pathname) =>
  pathname === routes.innsikt || pathname.startsWith(`${routes.innsikt}/`);

export const isPolitikerHubActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.politikerHub);

export const isAdminActive: NavIsActive = (pathname) =>
  pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);

/** Combined Utforsk active state for mobile (includes politikere/saker). */
export const isMobileUtforskActive: NavIsActive = (pathname) =>
  isUtforskActive(pathname) || isPolitikereActive(pathname);

/** Core product areas — header primary tabs and top of dashboard sidebar. */
export const coreNavItems: SiteNavLinkItem[] = [
  {
    title: 'Utforsk',
    href: routes.utforsk,
    icon: Search,
    isActive: isUtforskActive,
  },
  {
    title: 'Avstemninger',
    href: routes.avstemninger,
    icon: Vote,
    isActive: isAvstemningerActive,
  },
  {
    title: 'Høringer',
    href: routes.horinger,
    icon: FileEdit,
    isActive: isHoringerActive,
  },
  {
    title: 'Forslag',
    href: routes.forslag,
    icon: Lightbulb,
    isActive: isForslagActive,
  },
];

/** Secondary dashboard destinations — sidebar only (not repeated in header «Mer»). */
export const extendedNavItems: SiteNavLinkItem[] = [
  {
    title: 'Politikere',
    href: routes.politikere,
    icon: Users,
    isActive: isPolitikereActive,
  },
  {
    title: 'Borgerinitiativ',
    href: routes.initiativ,
    icon: FileEdit,
    isActive: isInitiativActive,
  },
  {
    title: 'Kalender',
    href: routes.kalender,
    icon: Calendar,
    isActive: isKalenderActive,
  },
  {
    title: 'Innsikt',
    href: routes.innsikt,
    icon: BarChart2,
    isActive: isInnsiktActive,
  },
  {
    title: 'Politiker-hub',
    href: routes.politikerHub,
    icon: BarChart2,
    isActive: isPolitikerHubActive,
  },
];

/** Account — sidebar bottom; profile menu on header. */
export const accountNavItems: SiteNavLinkItem[] = [
  {
    title: 'Min side',
    href: routes.minSide,
    icon: UserRound,
    isActive: isMinSideActive,
  },
];

/** Flat desktop primary nav — core items only, no «Mer» overflow. */
export const desktopPrimaryNavLinks: PrimaryNavLink[] = coreNavItems.map((item) => ({
  label: item.title,
  href: item.href,
  isActive: item.isActive ?? (() => false),
}));

/**
 * Dashboard sidebar + mobile drawer — single in-app nav surface.
 * Header primary/Mer are hidden on dashboard routes.
 */
export const dashboardSidebarNavItems: SiteNavLinkItem[] = [
  ...coreNavItems,
  ...extendedNavItems,
  ...accountNavItems,
];

/** Mobile bottom nav items (2–5 slots). */
export const mobileNavItems = [
  {
    label: 'Utforsk',
    href: routes.utforsk,
    icon: Search,
    isActive: isMobileUtforskActive,
  },
  {
    label: 'Avstemninger',
    href: routes.avstemninger,
    icon: Vote,
    isActive: isAvstemningerActive,
  },
  {
    label: 'Høringer',
    href: routes.horinger,
    icon: FileEdit,
    isActive: isHoringerActive,
  },
  {
    label: 'Profil',
    href: routes.minSide,
    icon: UserRound,
    isActive: isMinSideActive,
  },
] as const;

/** All dashboard nav hrefs — used to guard against duplicate header entries. */
export const dashboardNavHrefs = new Set(dashboardSidebarNavItems.map((item) => item.href));
