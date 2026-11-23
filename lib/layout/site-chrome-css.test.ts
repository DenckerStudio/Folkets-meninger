import assert from 'node:assert/strict';
import {
  SITE_HEADER_FLAG_STRIPE_REM,
  SITE_HEADER_NAV_HEIGHT_REM,
  applyMeasuredSiteHeaderHeight,
  formatMeasuredChromeHeight,
} from '@/lib/layout/site-chrome-css';

assert.equal(SITE_HEADER_NAV_HEIGHT_REM, 4);
assert.equal(SITE_HEADER_FLAG_STRIPE_REM, 0.375);
assert.equal(formatMeasuredChromeHeight(70.2), '71px');

const styleStore: Record<string, string> = {};
const root = {
  style: {
    setProperty(name: string, value: string) {
      styleStore[name] = value;
    },
    removeProperty(name: string) {
      delete styleStore[name];
    },
  },
} as unknown as HTMLElement;

applyMeasuredSiteHeaderHeight(root, 71.1);
assert.equal(styleStore['--site-header-height'], '72px');
applyMeasuredSiteHeaderHeight(root, null);
assert.equal(styleStore['--site-header-height'], undefined);

console.log('site-chrome-css.test.ts: ok');