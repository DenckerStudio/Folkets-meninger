#!/usr/bin/env node
/**
 * Manual/CI helper: expanded reel share dialog must stack above reel shell (z 400).
 * Skips quietly when Utforsk has no Reels items.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.SHARE_SHOT_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${baseUrl}/dashboard/utforsk`, { waitUntil: 'networkidle' });

  const reelsCta = page.getByRole('button', { name: /Reels/i }).first();
  if ((await reelsCta.count()) === 0) {
    console.log('reel-share-overlay-manual: skip (no reels CTA)');
    await browser.close();
    return;
  }
  await reelsCta.click();
  await page.waitForTimeout(800);

  const stem = page.getByRole('button', { name: /Del avstemningen/i }).first();
  if ((await stem.count()) === 0) {
    console.log('reel-share-overlay-manual: skip (no reel del trigger)');
    await browser.close();
    return;
  }

  await stem.click();
  const shareDialog = page.locator('[role=dialog]').last();
  await shareDialog.waitFor({ state: 'visible', timeout: 10_000 });

  const topZ = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role=dialog]')];
    const share = dialogs[dialogs.length - 1];
    const reel = dialogs.find((el) => getComputedStyle(el).backgroundColor.includes('0, 32, 91'));
    const zShare = share ? Number.parseInt(getComputedStyle(share.parentElement ?? share).zIndex, 10) : 0;
    const zReel = reel ? Number.parseInt(getComputedStyle(reel.parentElement ?? reel).zIndex, 10) : 0;
    return { zShare, zReel, dialogCount: dialogs.length };
  });

  if (topZ.zShare <= topZ.zReel && topZ.zReel > 0) {
    throw new Error(`share dialog z-index ${topZ.zShare} not above reel ${topZ.zReel}`);
  }

  await page.screenshot({ path: `${outDir}/reel-share-overlay-390.png` });
  console.log('reel-share-overlay-manual: ok', topZ);
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
