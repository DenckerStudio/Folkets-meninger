import type { LucideIcon } from 'lucide-react';
import { FileText, HeartHandshake, PieChart, Settings, Shield, SlidersHorizontal } from 'lucide-react';

export type ProfileTabId =
  | 'historikk'
  | 'valgomat'
  | 'innstillinger'
  | 'preferanser'
  | 'stemme-plus'
  | 'min-data';

export const PROFILE_TABS: {
  id: ProfileTabId;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: 'historikk',
    label: 'Mine stemmer',
    icon: FileText,
    description: 'Stemmehistorikk på saker',
  },
  {
    id: 'valgomat',
    label: 'Valgomat 2.0',
    icon: PieChart,
    description: 'Partimatch basert på stemmer',
  },
  {
    id: 'innstillinger',
    label: 'Mine hjertesaker',
    icon: Settings,
    description: 'Navn og interesseområder',
  },
  {
    id: 'preferanser',
    label: 'Preferanser',
    icon: SlidersHorizontal,
    description: 'Utseende, varsler og hjelp',
  },
  {
    id: 'stemme-plus',
    label: 'Stemme+',
    icon: HeartHandshake,
    description: 'Støtt oss og få fordeler',
  },
  {
    id: 'min-data',
    label: 'Personvern',
    icon: Shield,
    description: 'Data og personvern',
  },
];

export const PROFILE_TAB_IDS = PROFILE_TABS.map((t) => t.id);

export function isProfileTabId(value: string | null): value is ProfileTabId {
  return value !== null && PROFILE_TAB_IDS.includes(value as ProfileTabId);
}

export function getProfileTabLabel(tabId: ProfileTabId): string {
  const tab = PROFILE_TABS.find((item) => item.id === tabId);
  return tab?.label ?? 'Profil';
}

export function getProfileTabDescription(tabId: ProfileTabId): string {
  const tab = PROFILE_TABS.find((item) => item.id === tabId);
  return tab?.description ?? '';
}

/** Legacy `?tab=varsler` links land on Preferanser. */
export function resolveProfileTab(tabParam: string | null): ProfileTabId | null {
  if (tabParam === 'varsler') return 'preferanser';
  if (isProfileTabId(tabParam)) return tabParam;
  return null;
}
