import type { LucideIcon } from 'lucide-react';
import { FileText, LayoutGrid, MessageSquareQuote, ShieldCheck, Tags } from 'lucide-react';

export type PolitikerTabId = 'oversikt' | 'forslag' | 'saksordfoerer' | 'temaer' | 'svar';

export const POLITIKER_TABS: {
  id: PolitikerTabId;
  label: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: 'oversikt',
    label: 'Oversikt',
    icon: LayoutGrid,
    description: 'Rolle og aktivitet',
  },
  {
    id: 'forslag',
    label: 'Forslag',
    icon: FileText,
    description: 'Saker politikeren har brakt opp',
  },
  {
    id: 'saksordfoerer',
    label: 'Saksordfører',
    icon: ShieldCheck,
    description: 'Saker politikeren følger for komiteen',
  },
  {
    id: 'temaer',
    label: 'Temaer',
    icon: Tags,
    description: 'Områder med mest involvering',
  },
  {
    id: 'svar',
    label: 'Offisielle svar',
    icon: MessageSquareQuote,
    description: 'Svar publisert på Folkets Stemme',
  },
];

export const POLITIKER_TAB_IDS = POLITIKER_TABS.map((tab) => tab.id);

export function isPolitikerTabId(value: string | null): value is PolitikerTabId {
  return value !== null && POLITIKER_TAB_IDS.includes(value as PolitikerTabId);
}
