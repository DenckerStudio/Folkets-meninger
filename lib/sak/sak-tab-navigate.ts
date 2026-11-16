import type { SakPageTabId } from '@/lib/sak/sak-page-tabs';

export const SAK_TAB_NAVIGATE_EVENT = 'sak-tab-change';

export type SakTabNavigateDetail = { tabId: SakPageTabId };

export function navigateToSakTab(tabId: SakPageTabId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<SakTabNavigateDetail>(SAK_TAB_NAVIGATE_EVENT, { detail: { tabId } }),
  );
}