#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SHARE_SHOT_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = join(process.cwd(), 'docs/share-samples');
mkdirSync(outDir, { recursive: true });

async function capture(page, name) {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
}

async function openModal(page, buttonName) {
  await page.getByRole('button', { name: buttonName }).first().click();
  await page.getByRole('dialog').last().waitFor({ state: 'visible', timeout: 15_000 });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const widths = [
    { width: 360, tag: '360px' },
    { width: 390, tag: '390px' },
    { width: 1280, tag: 'desktop' },
  ];

  for (const theme of ['light', 'dark']) {
    for (const { width, tag } of widths) {
      const context = await browser.newContext({
        viewport: { width, height: Math.max(844, 900) },
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
      const page = await context.newPage();
      await page.addInitScript((dark) => {
        document.documentElement.classList.toggle('dark', dark);
      }, theme === 'dark');

      await page.goto(`${baseUrl}/dashboard/utforsk`, { waitUntil: 'networkidle' });
      await openModal(page, 'Del Utforsk');
      await capture(page, `utforsk-${tag}-${theme}-open`);
      await page.getByRole('button', { name: 'Kopier lenke' }).click();
      await page.waitForTimeout(350);
      await capture(page, `utforsk-${tag}-${theme}-copied`);
      await context.close();
    }
  }

  await browser.close();
  console.log(`Saved PNGs under ${outDir}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
