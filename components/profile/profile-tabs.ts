import type { LucideIcon } from 'lucide-react';
import { Bell, FileText, HeartHandshake, PieChart, Settings, Shield, SlidersHorizontal, UserCircle } from 'lucide-react';

export type ProfileTabId =
  | 'historikk'
  | 'valgomat'
  | 'innstillinger'
  | 'offentlig'
  | 'preferanser'
  | 'varsler'
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
    id: 'offentlig',
    label: 'Offentlig profil',
    icon: UserCircle,
    description: 'Bio, parti og synlighet',
  },
  {
    id: 'preferanser',
    label: 'Preferanser',
    icon: SlidersHorizontal,
    description: 'Utseende, animasjoner og hjelp',
  },
  {
    id: 'varsler',
    label: 'Varsler',
    icon: Bell,
    description: 'E-post og kanaler',
  },
  {
    id: 'stemme-plus',
    label: 'Stemme+',
    icon: HeartHandshake,
    description: 'Støtt oss og få fordeler',
  },
  {
    id: 'min-data',
    label: 'Privacy Hub',
    icon: Shield,
    description: 'Data og personvern',
  },
];

export const PROFILE_TAB_IDS = PROFILE_TABS.map((t) => t.id);

export function isProfileTabId(value: string | null): value is ProfileTabId {
  return value !== null && PROFILE_TAB_IDS.includes(value as ProfileTabId);
}
