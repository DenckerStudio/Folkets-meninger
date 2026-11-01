import assert from 'node:assert/strict';
import { buildPageViewBody, shouldTrackPath } from '@/lib/analytics/page-view';

assert.deepEqual(
  buildPageViewBody({
    pathname: '/blogg',
    search: 'side=2',
    referrer: 'https://www.google.com/',
  }),
  {
    eventName: 'page_view',
    path: '/blogg?side=2',
    referrer: 'https://www.google.com/',
  },
);

assert.deepEqual(
  buildPageViewBody({
    pathname: '/',
    search: 'utm_source=facebook&utm_medium=social',
    referrer: '',
  }),
  {
    eventName: 'page_view',
    path: '/?utm_source=facebook&utm_medium=social',
    utm_source: 'facebook',
    utm_medium: 'social',
  },
);

assert.deepEqual(
  buildPageViewBody({
    pathname: '/del/abc',
    search: '',
    referrer: '   ',
  }),
  {
    eventName: 'page_view',
    path: '/del/abc',
  },
);

assert.deepEqual(
  buildPageViewBody({
    pathname: '/del/abc',
    search: 'fm_share=kode123&utm_source=facebook',
    referrer: '',
  }),
  {
    eventName: 'page_view',
    path: '/del/abc?fm_share=kode123&utm_source=facebook',
    utm_source: 'facebook',
    shareCode: 'kode123',
  },
);

assert.deepEqual(
  buildPageViewBody({
    pathname: '/blogg/hei',
    search: '?fm_share=',
    referrer: '',
  }),
  {
    eventName: 'page_view',
    path: '/blogg/hei?fm_share=',
  },
);

assert.equal(shouldTrackPath('/dashboard/admin'), false);
assert.equal(shouldTrackPath('/dashboard/admin/statistikk'), false);
assert.equal(shouldTrackPath('/'), true);
assert.equal(shouldTrackPath('/blogg/hei'), true);
assert.equal(shouldTrackPath('/del/abc'), true);

console.log('lib/analytics/page-view.test.ts ok');
