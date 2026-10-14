import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  Calendar,
  FileEdit,
  Lightbulb,
  Menu,
  MessagesSquare,
  Search,
  Shield,
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

export type MobileNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive: NavIsActive;
  action?: 'more';
};

export const isFolketsMeningerActive: NavIsActive = (pathname) =>
  pathname === routes.dashboard ||
  pathname === routes.folketsMeninger ||
  pathname.startsWith(`${routes.folketsMeninger}/`);

export const isUtforskActive: NavIsActive = (pathname) =>
  pathname === routes.utforsk ||
  pathname.startsWith(`${routes.utforsk}/`) ||
  pathname.startsWith(`${DASHBOARD_PREFIX}/sak/`);

export const isPolitikereActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.politikere) || pathname.startsWith(routes.representanter);

export const isAvstemningerActive: NavIsActive = (pathname) =>
  pathname === routes.avstemninger || pathname.startsWith(`${routes.avstemninger}/`);

export const isHoringerActive: NavIsActive = (pathname) =>
  pathname === routes.horinger || pathname.startsWith(`${routes.horinger}/`);

export const isForslagActive: NavIsActive = (pathname) =>
  pathname === routes.forslag ||
  pathname.startsWith(`${routes.forslag}/`) ||
  pathname === `${DASHBOARD_PREFIX}/forslag` ||
  pathname.startsWith(`${DASHBOARD_PREFIX}/forslag/`);

export const isKalenderActive: NavIsActive = (pathname) =>
  pathname === routes.kalender || pathname.startsWith(`${routes.kalender}/`);

export const isMinSideActive: NavIsActive = (pathname) =>
  pathname.startsWith(routes.minSide) || pathname.startsWith('/auth');

export const isOmOssActive: NavIsActive = (pathname) =>
  pathname === '/' || pathname === routes.home;

export const isInnsiktActive: NavIsActive = (pathname) =>
  pathname === routes.innsikt || pathname.startsWith(`${routes.innsikt}/`);

export const isAdminActive: NavIsActive = (pathname) =>
  pathname === routes.admin || pathname.startsWith(`${routes.admin}/`);

/** Combined Utforsk active state for mobile (includes politikere/saker). */
export const isMobileUtforskActive: NavIsActive = (pathname) =>
  isUtforskActive(pathname) || isPolitikereActive(pathname);

/** Core product areas — header primary tabs and top of dashboard sidebar. */
export const coreNavItems: SiteNavLinkItem[] = [
  {
    title: 'Folkets meninger',
    href: routes.folketsMeninger,
    icon: MessagesSquare,
    isActive: isFolketsMeningerActive,
  },
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
    title: 'Appens fremtid',
    href: routes.forslag,
    icon: Lightbulb,
    isActive: isForslagActive,
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

/** Appended for admins only — not in static sidebar/mobile arrays. */
export const adminAccountNavItem: SiteNavLinkItem = {
  title: 'Admin',
  href: routes.admin,
  icon: Shield,
  isActive: isAdminActive,
};

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

export function dashboardSidebarNavItemsForAdmin(isAdmin: boolean): SiteNavLinkItem[] {
  if (!isAdmin) return dashboardSidebarNavItems;
  return [...dashboardSidebarNavItems, adminAccountNavItem];
}

/** Mobile bottom nav items (exactly 5 slots). */
export const mobileNavItems: readonly MobileNavItem[] = [
  {
    label: 'Meninger',
    href: routes.folketsMeninger,
    icon: MessagesSquare,
    isActive: isFolketsMeningerActive,
  },
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
    label: 'Mer',
    href: '#mer',
    icon: Menu,
    isActive: () => false,
    action: 'more' as const,
  },
] as const;

/** Items shown in the mobile drawer when «Mer» is opened. */
export const mobileMoreNavItems: SiteNavLinkItem[] = [
  {
    title: 'Profil',
    href: routes.minSide,
    icon: UserRound,
    isActive: isMinSideActive,
  },
  {
    title: 'Appens fremtid',
    href: routes.forslag,
    icon: Lightbulb,
    isActive: isForslagActive,
  },
  {
    title: 'Politikere',
    href: routes.politikere,
    icon: Users,
    isActive: isPolitikereActive,
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
];

/** All dashboard nav hrefs — used to guard against duplicate header entries. */
export const dashboardNavHrefs = new Set([
  ...dashboardSidebarNavItems.map((item) => item.href),
  routes.admin,
]);