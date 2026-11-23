/** Matcher `h-16` i site-header-nav. */
export const SITE_HEADER_NAV_HEIGHT_REM = 4;

/** Matcher `h-1.5` på `FlagStripe` i landing-header. */
export const SITE_HEADER_FLAG_STRIPE_REM = 0.375;

export const SITE_CHROME_CSS_VARS = {
  siteHeaderHeight: '--site-header-height',
  sakPageTabsStickyHeight: '--sak-page-tabs-sticky-height',
} as const;

export function formatMeasuredChromeHeight(px: number): string {
  return `${Math.ceil(px)}px`;
}

export function applyMeasuredSiteHeaderHeight(root: HTMLElement, height: number | null): void {
  if (height == null || height <= 0) {
    root.style.removeProperty(SITE_CHROME_CSS_VARS.siteHeaderHeight);
    return;
  }
  root.style.setProperty(SITE_CHROME_CSS_VARS.siteHeaderHeight, formatMeasuredChromeHeight(height));
}

export function applyMeasuredSakPageTabsHeight(root: HTMLElement, height: number | null): void {
  if (height == null || height <= 0) {
    root.style.removeProperty(SITE_CHROME_CSS_VARS.sakPageTabsStickyHeight);
    return;
  }
  root.style.setProperty(SITE_CHROME_CSS_VARS.sakPageTabsStickyHeight, formatMeasuredChromeHeight(height));
}

export function clearSakPageTabsStickyHeight(root: HTMLElement): void {
  root.style.removeProperty(SITE_CHROME_CSS_VARS.sakPageTabsStickyHeight);
}