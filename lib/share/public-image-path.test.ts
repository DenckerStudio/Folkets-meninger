import assert from 'node:assert/strict';
import { isPublicDashboardShareImagePath, isPublicDelShareImagePath, isPublicShareImagePath } from '@/lib/routes';

for (const path of [
  '/dashboard/sak/104123/opengraph-image',
  '/dashboard/avstemninger/0b6f8a7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/opengraph-image',
  '/dashboard/folkets-meninger/abc/opengraph-image',
  '/dashboard/sak/104123/twitter-image',
  '/dashboard/sak/104123/opengraph-image-1a2b3c',
  '/dashboard/utforsk/reels/opengraph-image',
]) {
  assert.equal(isPublicDashboardShareImagePath(path), true, path);
}

for (const path of [
  '/del/abc-123/opengraph-image',
  '/del/abc-123/twitter-image',
]) {
  assert.equal(isPublicDelShareImagePath(path), true, path);
  assert.equal(isPublicShareImagePath(path), true, path);
}

for (const path of [
  '/dashboard/sak/104123',
  '/dashboard/admin/opengraph-image',
  '/dashboard/min-side/x/opengraph-image',
  '/dashboard/sak/104123/opengraph-image/extra',
  '/dashboard/sak/opengraph-image',
]) {
  assert.equal(isPublicDashboardShareImagePath(path), false, path);
}

console.log('public share image paths: ok');
