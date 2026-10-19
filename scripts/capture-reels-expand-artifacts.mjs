import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts';
const PREFIX = process.argv[2] || 'after';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

async function openVoteFace(page) {
  await page.goto(`${BASE}/dashboard/utforsk/reels?preview=mock`, { waitUntil: 'networkidle', timeout: 120_000 });
  const reelsDialog = page.getByRole('dialog', { name: 'Reels' });
  await reelsDialog.waitFor({ state: 'visible', timeout: 120_000 });

  const empty = page.getByRole('heading', { name: 'Ingen Reels publisert ennå' });
  if (await empty.isVisible().catch(() => false)) {
    console.error('No published reels in environment — cannot capture vote/expand UI.');
    process.exit(2);
  }

  const activeCard = reelsDialog.locator('[aria-current="true"]').first();
  const voteCta = activeCard.getByRole('button', { name: 'Trykk for å stemme' });
  if (await voteCta.count()) {
    await voteCta.click();
  } else {
    await reelsDialog.getByRole('button', { name: 'Trykk for å stemme' }).first().click();
  }
  await page.getByTestId('reel-vote-face').waitFor({ state: 'visible' });
  return reelsDialog;
}

async function capture(viewport, suffix) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  fs.mkdirSync(ARTIFACTS, { recursive: true });

  await openVoteFace(page);
  const closedPath = path.join(ARTIFACTS, `${PREFIX}_reels_card_${suffix}.png`);
  await page.screenshot({ path: closedPath, fullPage: false });

  const lesMer = page.getByRole('button', { name: 'Les mer' }).first();
  if (await lesMer.isVisible().catch(() => false)) {
    await lesMer.click();
  } else {
    await page.getByTestId('reel-vote-face').click({ position: { x: 40, y: 80 } });
  }

  const expanded = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Lukk' }) }).last();
  await expanded.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(900);
  await expanded.evaluate((el) => {
    el.style.transform = 'none';
  });
  const expandedPath = path.join(ARTIFACTS, `${PREFIX}_reels_expanded_${suffix}.png`);
  await page.screenshot({ path: expandedPath, fullPage: false });

  console.log(closedPath);
  console.log(expandedPath);
  await browser.close();
}

await capture({ width: 1280, height: 800 }, 'desktop_1280x800');
await capture({ width: 390, height: 844 }, 'mobile_390x844');
