import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = process.env.SAK_LAYOUT_ARTIFACTS_DIR || '/opt/cursor/artifacts';
const SAK_IDS = ['200192', '200075'] as const;
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'mobile-390', width: 390, height: 844 },
] as const;

async function captureSak(page: Page, sakId: string, label: string) {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const res = await page.goto(`/dashboard/sak/${sakId}`, { waitUntil: 'load', timeout: 120_000 });
    test.skip(
      res?.status() === 404,
      `Sak ${sakId} ikke tilgjengelig lokalt (HTTP ${res?.status() ?? 'ukjent'}).`,
    );
    await page.waitForTimeout(1500);
    const file = path.join(ARTIFACTS, `sak-${sakId}-${label}-${viewport.name}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, fullPage: true });
  }
}

test.describe('Sak layout screenshots', () => {
  test.setTimeout(600_000);

  test('branch layout', async ({ page }) => {
    const label = process.env.SAK_LAYOUT_LABEL || 'branch';
    for (const sakId of SAK_IDS) {
      await captureSak(page, sakId, label);
    }
  });
});