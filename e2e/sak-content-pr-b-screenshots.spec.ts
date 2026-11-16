import { test, expect } from '@playwright/test';
import path from 'node:path';

const SAK_IDS = ['200192', '200075'] as const;
const ARTIFACT_DIR = path.join('/opt/cursor/artifacts');

for (const sakId of SAK_IDS) {
  test.describe(`Sak ${sakId} PR B innhold`, () => {
    test.setTimeout(120_000);

    test(`desktop 1440 @ sak ${sakId}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const response = await page.goto(`/dashboard/sak/${sakId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      expect(response?.status()).toBeLessThan(500);
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `sak-${sakId}-desktop-1440-pr-b.png`),
        fullPage: true,
      });
      await context.close();
    });

    test(`mobil 390 @ sak ${sakId}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const response = await page.goto(`/dashboard/sak/${sakId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      expect(response?.status()).toBeLessThan(500);
      await page.waitForTimeout(2500);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `sak-${sakId}-mobile-390-pr-b.png`),
        fullPage: true,
      });
      await context.close();
    });
  });
}