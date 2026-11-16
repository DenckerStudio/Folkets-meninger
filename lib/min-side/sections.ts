import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  FileText,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  Shield,
} from 'lucide-react';
import { routes } from '@/lib/routes';

export type MinSideSectionId =
  | 'oversikt'
  | 'stemmer-og-meninger'
  | 'varsler'
  | 'stemme-plus'
  | 'nokler'
  | 'personvern';

export type MinSideNavItem = {
  id: MinSideSectionId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const minSideBase = routes.minSide;

export const MIN_SIDE_NAV_ITEMS: MinSideNavItem[] = [
  {
    id: 'oversikt',
    label: 'Oversikt',
    description: 'Nøkkeltall og snarveier',
    href: minSideBase,
    icon: LayoutDashboard,
  },
  {
    id: 'stemmer-og-meninger',
    label: 'Mine stemmer og meninger',
    description: 'Holdninger, valgomat og hjertesaker',
    href: `${minSideBase}/stemmer-og-meninger`,
    icon: FileText,
  },
  {
    id: 'varsler',
    label: 'Varsler',
    description: 'E-post og app-innstillinger',
    href: `${minSideBase}/varsler`,
    icon: Bell,
  },
  {
    id: 'stemme-plus',
    label: 'Stemme+',
    description: 'Abonnement og fordeler',
    href: `${minSideBase}/stemme-plus`,
    icon: HeartHandshake,
  },
  {
    id: 'nokler',
    label: 'Språkmodellnøkkel',
    description: 'Din egen modell for chat',
    href: `${minSideBase}/nokler`,
    icon: KeyRound,
  },
  {
    id: 'personvern',
    label: 'Personvern og konto',
    description: 'Data, samtykke og konto',
    href: `${minSideBase}/personvern`,
    icon: Shield,
  },
];

export function minSideSectionHref(id: MinSideSectionId): string {
  const item = MIN_SIDE_NAV_ITEMS.find((entry) => entry.id === id);
  return item?.href ?? minSideBase;
}

export function resolveMinSideSectionId(pathname: string): MinSideSectionId {
  const normalized = pathname.replace(/\/$/, '') || routes.minSide;
  if (normalized === routes.minSide) return 'oversikt';
  for (const item of MIN_SIDE_NAV_ITEMS) {
    if (item.id !== 'oversikt' && normalized.startsWith(item.href)) {
      return item.id;
    }
  }
  return 'oversikt';
}

/** Legacy `?tab=` on `/dashboard/min-side` → section path. */
const LEGACY_TAB_TO_SECTION: Record<string, MinSideSectionId> = {
  historikk: 'stemmer-og-meninger',
  valgomat: 'stemmer-og-meninger',
  innstillinger: 'stemmer-og-meninger',
  preferanser: 'varsler',
  varsler: 'varsler',
  'stemme-plus': 'stemme-plus',
  'min-data': 'personvern',
};

export function legacyTabRedirectPath(tab: string | null): string | null {
  if (!tab) return null;
  const section = LEGACY_TAB_TO_SECTION[tab];
  if (!section) return null;
  return minSideSectionHref(section);
}

export function isMinSidePath(pathname: string): boolean {
  return pathname === routes.minSide || pathname.startsWith(`${routes.minSide}/`);
}