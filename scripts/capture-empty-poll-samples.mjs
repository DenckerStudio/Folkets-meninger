/**
 * Capture empty poll list states from production server (next start).
 * Output: docs/empty-poll-samples/{avstemninger|utforsk}-{360|390|desktop}-{light|dark}.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = join(process.cwd(), 'docs/empty-poll-samples');

const viewports = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

const pages = [
  { slug: 'avstemninger', path: '/dashboard/avstemninger' },
  { slug: 'utforsk', path: '/dashboard/utforsk' },
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ['light', 'dark']) {
    for (const vp of viewports) {
      for (const pageDef of pages) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
        });
        const page = await context.newPage();
        await page.goto(`${baseUrl}${pageDef.path}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('status').filter({ hasText: 'Ingen avstemninger er publisert ennå' }).waitFor({
          timeout: 120_000,
        });
        await page.waitForTimeout(500);
        const file = join(outDir, `${pageDef.slug}-${vp.name}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: false });
        await context.close();
        console.log('wrote', file);
      }
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
