import { routes } from '@/lib/routes';

export const VURDER_TABS = [
  { id: 'reels', label: 'Reels' },
  { id: 'blogg', label: 'Blogginnlegg' },
  { id: 'sammendrag', label: 'Sammendrag' },
] as const;

export type VurderTabId = (typeof VURDER_TABS)[number]['id'];

export function parseVurderTab(value: string | null | undefined): VurderTabId {
  switch (value) {
    case 'reels':
    case 'blogg':
    case 'sammendrag':
      return value;
    default:
      return 'reels';
  }
}

export function adminVurderHref(tab: VurderTabId, pollId?: string): string {
  const params = new URLSearchParams();
  params.set('fane', tab);
  const id = pollId?.trim();
  if (id) params.set('pollId', id);
  return `${routes.adminVurder}?${params.toString()}`;
}
