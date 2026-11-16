import { sakPageTabPanelId } from '@/lib/sak/anchors';
import type { SakPageTabId } from '@/lib/sak/sak-page-tabs';
import { navigateToSakTab } from '@/lib/sak/sak-tab-navigate';

export type WaitForElementOptions = {
  timeoutMs?: number;
  pollMs?: number;
};

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_POLL_MS = 50;

const timerScope = typeof window !== 'undefined' ? window : globalThis;

export function waitForElementById(
  elementId: string,
  options: WaitForElementOptions = {},
): Promise<HTMLElement | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;

  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const started = Date.now();

    const tryResolve = () => {
      const el = document.getElementById(elementId);
      if (el) {
        cleanup();
        resolve(el as HTMLElement);
        return true;
      }
      if (Date.now() - started >= timeoutMs) {
        cleanup();
        resolve(null);
        return true;
      }
      return false;
    };

    const timer = timerScope.setInterval(() => {
      tryResolve();
    }, pollMs);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined' && document.body) {
      observer = new MutationObserver(() => {
        tryResolve();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    const cleanup = () => {
      observer?.disconnect();
      timerScope.clearInterval(timer);
    };

    if (tryResolve()) return;
  });
}

const FOCUS_RING_CLASSES = ['ring-2', 'ring-brand', 'ring-offset-2', 'ring-offset-background'] as const;

export function flashSakSearchTarget(el: HTMLElement): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add(...FOCUS_RING_CLASSES);
  timerScope.setTimeout(() => {
    el.classList.remove(...FOCUS_RING_CLASSES);
  }, 1_600);
  if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) {
    el.tabIndex = -1;
  }
  el.focus({ preventScroll: true });
}

export async function focusSakSearchAnchor(anchorId: string): Promise<boolean> {
  const el = await waitForElementById(anchorId);
  if (!el) return false;
  flashSakSearchTarget(el);
  return true;
}

export async function focusSakSearchHit(
  tab: SakPageTabId,
  anchorId: string,
): Promise<boolean> {
  navigateToSakTab(tab);
  await waitForElementById(sakPageTabPanelId(tab), { timeoutMs: 5_000, pollMs: 40 });
  return focusSakSearchAnchor(anchorId);
}

export type NavigateToSakTab = (tab: SakPageTabId) => void;