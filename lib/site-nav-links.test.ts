import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountNavItems,
  adminAccountNavItem,
  coreNavItems,
  dashboardNavHrefs,
  dashboardSidebarNavItems,
  dashboardSidebarNavItemsForAdmin,
  desktopPrimaryNavLinks,
  extendedNavItems,
  isUtforskActive,
} from '@/lib/site-nav-links';
import { DASHBOARD_PREFIX, routes } from '@/lib/routes';

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

test('utforsk is active on sak pages and reels', () => {
  assert.equal(isUtforskActive(routes.utforsk), true);
  assert.equal(isUtforskActive(`${routes.utforsk}/reels`), true);
  assert.equal(isUtforskActive(`${DASHBOARD_PREFIX}/sak/123`), true);
});

test('every sidebar href is registered in dashboardNavHrefs', () => {
  for (const item of dashboardSidebarNavItems) {
    assert.ok(dashboardNavHrefs.has(item.href), item.href);
  }
});

test('folkets meninger is the first core destination', () => {
  assert.equal(coreNavItems[0]?.href, routes.folketsMeninger);
});

test('Chat is not a sidebar or primary destination', () => {
  assert.equal(
    extendedNavItems.some((item) => item.href === routes.chat),
    false,
  );
  assert.equal(
    dashboardSidebarNavItems.some((item) => item.href === routes.chat),
    false,
  );
  assert.equal(
    desktopPrimaryNavLinks.some((link) => link.href === routes.chat),
    false,
  );
});

test('appens fremtid is in extendedNavItems (not core)', () => {
  const item = extendedNavItems.find((entry) => entry.href === routes.forslag);
  assert.ok(item);
  assert.equal(item.title, 'Appens fremtid');
  assert.equal(routes.forslag, '/dashboard/appens-fremtid');

  // Verify it's NOT in coreNavItems
  const coreItem = coreNavItems.find((entry) => entry.href === routes.forslag);
  assert.equal(coreItem, undefined);
});

test('avstemninger is item index 2 in dashboard sidebar; politiker-hub still absent', () => {
  assert.equal(dashboardSidebarNavItems[2]?.href, routes.avstemninger);
  assert.equal(
    dashboardSidebarNavItems.some((item) => item.href === routes.politikerHub),
    false,
  );
});

test('dashboard sidebar has exact title order', () => {
  const expectedTitles = [
    'Folkets meninger',
    'Utforsk',
    'Avstemninger',
    'Høringer',
    'Politikere',
    'Kalender',
    'Innsikt',
    'Appens fremtid',
    'Min side',
  ];
  const actualTitles = dashboardSidebarNavItems.map((item) => item.title);
  assert.deepEqual(actualTitles, expectedTitles);
});

test('admin sidebar item is appended only for admins', () => {
  assert.equal(dashboardSidebarNavItemsForAdmin(false).length, dashboardSidebarNavItems.length);
  assert.equal(
    dashboardSidebarNavItemsForAdmin(true).at(-1)?.href,
    adminAccountNavItem.href,
  );
});

test('admin nav item highlights admin routes', () => {
  assert.equal(adminAccountNavItem.isActive?.(routes.admin), true);
  assert.equal(adminAccountNavItem.isActive?.(`${routes.admin}/reels`), true);
  assert.equal(adminAccountNavItem.isActive?.(routes.minSide), false);
});
