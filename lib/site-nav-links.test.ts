import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountNavItems,
  coreNavItems,
  dashboardNavHrefs,
  dashboardSidebarNavItems,
  desktopPrimaryNavLinks,
  extendedNavItems,
  mobileNavItems,
} from '@/lib/site-nav-links';
import { routes } from '@/lib/routes';

test('dashboard sidebar is composed from core, extended, and account tiers', () => {
  assert.deepEqual(
    dashboardSidebarNavItems.map((item) => item.href),
    [...coreNavItems, ...extendedNavItems, ...accountNavItems].map((item) => item.href),
  );
});

test('desktop primary nav mirrors core items without extra destinations', () => {
  assert.equal(desktopPrimaryNavLinks.length, coreNavItems.length);
  for (const primary of desktopPrimaryNavLinks) {
    const core = coreNavItems.find((item) => item.href === primary.href);
    assert.ok(core, `missing core item for primary link ${primary.href}`);
    assert.equal(primary.label, core.title);
  }
});

test('primary nav does not repeat sidebar-only destinations', () => {
  const primaryHrefs = new Set(desktopPrimaryNavLinks.map((link) => link.href));
  for (const href of [...extendedNavItems, ...accountNavItems].map((item) => item.href)) {
    assert.equal(primaryHrefs.has(href), false, `primary nav should not include ${href}`);
  }
});

test('every sidebar href is registered in dashboardNavHrefs', () => {
  for (const item of dashboardSidebarNavItems) {
    assert.ok(dashboardNavHrefs.has(item.href), item.href);
  }
});

test('folkets meninger is the first core destination', () => {
  assert.equal(coreNavItems[0]?.href, routes.folketsMeninger);
});

test('borgerinitiativ is not in dashboard nav', () => {
  assert.equal(
    dashboardSidebarNavItems.some((item) => item.href === routes.initiativ),
    false,
  );
});

test('mobile nav stays within core destinations plus profile', () => {
  assert.ok(mobileNavItems.length >= 2 && mobileNavItems.length <= 5);
  const allowed = new Set([
    routes.folketsMeninger,
    routes.utforsk,
    routes.avstemninger,
    routes.horinger,
    routes.minSide,
  ]);
  for (const item of mobileNavItems) {
    assert.ok(allowed.has(item.href), `unexpected mobile nav href ${item.href}`);
  }
});
