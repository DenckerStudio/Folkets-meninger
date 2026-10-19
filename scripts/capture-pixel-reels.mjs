import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

async function openVoteFace(page) {
  await page.goto(`${BASE}/dashboard/utforsk/reels?preview=mock`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  const reelsDialog = page.getByRole('dialog', { name: 'Reels' });
  await reelsDialog.waitFor({ state: 'visible', timeout: 120_000 });
  const voteCta = reelsDialog.getByRole('button', { name: 'Trykk for å stemme' }).first();
  await voteCta.scrollIntoViewIfNeeded();
  await voteCta.click();
  await page.getByTestId('reel-vote-face').waitFor({ state: 'visible' });
}

async function expandFromVoteFace(page) {
  const lesMer = page.getByRole('button', { name: 'Les mer' }).first();
  if (await lesMer.isVisible().catch(() => false)) {
    await lesMer.click();
  } else {
    throw new Error('Les mer not visible — cannot open expanded view for capture');
  }
  const expanded = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: 'Lukk' }) })
    .last();
  await expanded.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(900);
  await expanded.evaluate((el) => {
    el.style.transform = 'none';
  });
}

fs.mkdirSync(ARTIFACTS, { recursive: true });

const browser = await chromium.launch();

// Desktop expanded 1280
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await openVoteFace(page);
  await expandFromVoteFace(page);
  const out = path.join(ARTIFACTS, 'pixel_reels_expanded_desktop_1280x800.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(out);
  await page.close();
}

// Mobile expanded fullscreen 390
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openVoteFace(page);
  await expandFromVoteFace(page);
  const out = path.join(ARTIFACTS, 'pixel_reels_expanded_mobile_390x844.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(out);
  await page.close();
}

// Mobile 390 — reels open, vote face collapsed (chat orb reposition visible)
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await openVoteFace(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    if (document.querySelector('.chat-orb')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chat-orb';
    btn.setAttribute('data-chat-orb', '');
    btn.setAttribute('aria-label', 'Åpne Stemme+');
    btn.textContent = 'Stemme+';
    document.body.appendChild(btn);
  });
  const orb = page.locator('.chat-orb');
  await orb.waitFor({ state: 'visible', timeout: 10_000 });
  const out = path.join(ARTIFACTS, 'pixel_reels_mobile_390_chat_orb_vote.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log(out);
  await page.close();
}

await browser.close();
