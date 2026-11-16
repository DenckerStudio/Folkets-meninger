import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isMinSidePath,
  legacyTabRedirectPath,
  minSideSectionHref,
  resolveMinSideSectionId,
  MIN_SIDE_NAV_ITEMS,
} from '@/lib/min-side/sections';
import { routes } from '@/lib/routes';

test('min-side nav has six sections in declared order', () => {
  assert.equal(MIN_SIDE_NAV_ITEMS.length, 6);
  assert.deepEqual(
    MIN_SIDE_NAV_ITEMS.map((item) => item.id),
    ['oversikt', 'stemmer-og-meninger', 'varsler', 'stemme-plus', 'nokler', 'personvern'],
  );
});

test('resolveMinSideSectionId marks sub-routes active', () => {
  assert.equal(resolveMinSideSectionId(routes.minSide), 'oversikt');
  assert.equal(resolveMinSideSectionId(`${routes.minSide}/varsler`), 'varsler');
  assert.equal(resolveMinSideSectionId(`${routes.minSide}/stemme-plus`), 'stemme-plus');
});

test('legacy tab query maps to section hrefs', () => {
  assert.equal(legacyTabRedirectPath('historikk'), minSideSectionHref('stemmer-og-meninger'));
  assert.equal(legacyTabRedirectPath('preferanser'), minSideSectionHref('varsler'));
  assert.equal(legacyTabRedirectPath('stemme-plus'), minSideSectionHref('stemme-plus'));
  assert.equal(legacyTabRedirectPath('min-data'), minSideSectionHref('personvern'));
  assert.equal(legacyTabRedirectPath('unknown'), null);
});

test('isMinSidePath covers overview and nested routes', () => {
  assert.equal(isMinSidePath(routes.minSide), true);
  assert.equal(isMinSidePath(`${routes.minSide}/personvern`), true);
  assert.equal(isMinSidePath(routes.utforsk), false);
});