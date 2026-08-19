import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  FileEdit,
  Info,
  Search,
  UserRound,
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
  pathname.startsWith(`${DASHBOARD_PREFIX}/admin/`);

/** Combined Utforsk active state for mobile (includes politikere/saker). */
export const isMobileUtforskActive: NavIsActive = (pathname) =>
  isUtforskActive(pathname) || isPolitikereActive(pathname);

/** Flat desktop primary nav — no duplicates. */
export const desktopPrimaryNavLinks: PrimaryNavLink[] = [
  { label: 'Utforsk', href: routes.utforsk, isActive: isUtforskActive },
  { label: 'Avstemninger', href: routes.avstemninger, isActive: isAvstemningerActive },
  { label: 'Høringer', href: routes.horinger, isActive: isHoringerActive },
];

/** Secondary links in the «Mer» dropdown. */
export const desktopMoreNavLinks: SiteNavLinkItem[] = [
  {
    title: 'Om oss',
    href: routes.omOss,
    description: 'Misjon, personvern og veien videre',
    icon: Info,
    isActive: isOmOssActive,
  },
  {
    title: 'Åpen innsikt',
    href: routes.innsikt,
    description: 'Anonyme stemmetall per sak',
    icon: BarChart2,
    isActive: isInnsiktActive,
  },
  {
    title: 'Borgerinitiativ',
    href: routes.initiativ,
    description: 'Foreslå nasjonale avstemninger',
    icon: FileEdit,
    isActive: isInitiativActive,
  },
  {
    title: 'Politiker-hub',
    href: routes.politikerHub,
    description: 'Innsikt og svar til innbyggere',
    icon: BarChart2,
    isActive: isPolitikerHubActive,
  },
];

/** Mobile bottom nav items. */
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
