import { test, expect } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = '/opt/cursor/artifacts';

test.describe('Research-markeringer (visuell)', () => {
  test('saksside uten research-markering-toolbar', async ({ page }) => {
    test.setTimeout(120_000);
    test.info().annotations.push({
    type: 'note',
    description: 'Etter: ingen «Research-markeringer» / «Mine notater» på sakssiden.',
  });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/sak/200329', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await expect(page.getByRole('button', { name: /Research-markeringer|Mine notater/i })).toHaveCount(0);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sak-no-annotations-desktop-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard/sak/200329', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await expect(page.getByRole('button', { name: /Research-markeringer|Mine notater/i })).toHaveCount(0);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sak-no-annotations-mobile-390.png'),
      fullPage: true,
    });
  });

  test('admin research med markering (krever innlogging)', async ({ page }) => {
    const clusterId = process.env.E2E_ADMIN_RESEARCH_CLUSTER_ID?.trim();
    if (!clusterId) {
      test.skip(true, 'Mangler E2E_ADMIN_RESEARCH_CLUSTER_ID og lagret admin-sesjon — kan ikke ta skjermbilde.');
      return;
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto(`/dashboard/admin/research/${clusterId}`);
    if (res?.status() === 401 || (await page.url()).includes('/auth/login')) {
      test.skip(true, 'Ingen admin-innlogging i miljøet.');
      return;
    }

    await expect(page.getByRole('button', { name: 'Research-markeringer' })).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'admin-research-annotations-desktop-1440.png'),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/admin/research/${clusterId}`);
    await expect(page.getByRole('button', { name: 'Research-markeringer' })).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'admin-research-annotations-mobile-390.png'),
      fullPage: true,
    });
  });
});