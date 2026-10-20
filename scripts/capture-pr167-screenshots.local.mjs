import { chromium, devices } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = process.env.SCREENSHOT_OUT_DIR ?? '/opt/cursor/artifacts/pr167/3a8d59b';
const authPath = process.env.PR167_AUTH_ENV ?? '/opt/cursor/artifacts/pr167-auth.local.env';

const auth = Object.fromEntries(
  (await readFile(authPath, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => line.split('=')),
);

await mkdir(outDir, { recursive: true });

async function login(page) {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(auth.EMAIL);
  await page.locator('input[name="password"]').fill(auth.PASS);
  await page.getByRole('button', { name: /logg inn/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

async function shot(page, name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
}

async function openAdminTab(page, tabLabel) {
  await page.goto(`${baseUrl}/dashboard/admin/forslag`, { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: tabLabel }).click();
  await page.waitForTimeout(400);
}

const browser = await chromium.launch();

// Desktop context
const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await desktop.newPage();
await login(page);

// Empty roadmap (capture before adding)
await openAdminTab(page, 'Veikart');
await shot(page, 'roadmap-empty-1280.png');

// Empty changelog
await openAdminTab(page, 'Endringslogg');
await shot(page, 'changelog-empty-1280.png');

// Roadmap list + add items via UI
await openAdminTab(page, 'Veikart');
await page.getByRole('button', { name: /legg til punkt/i }).click();
await page.locator('#roadmap-title').fill('Bedre veikart i admin');
await page.locator('#roadmap-body').fill('Dette er et **eksempel** på beskrivelse.');
await page.getByRole('button', { name: /^Legg til$/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /legg til punkt/i }).click();
await page.locator('#roadmap-title').fill('Andre punkt for rekkefølge');
await page.locator('#roadmap-body').fill('Kort tekst.');
await page.getByRole('button', { name: /^Legg til$/ }).click();
await page.waitForTimeout(800);
await shot(page, 'roadmap-list-1280.png');

// Drag in progress
const items = page.locator('ul li');
const first = items.nth(0);
const third = items.nth(1);
const firstBox = await first.boundingBox();
const thirdBox = await third.boundingBox();
if (firstBox && thirdBox) {
  await page.mouse.move(firstBox.x + 20, firstBox.y + firstBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(thirdBox.x + 20, thirdBox.y + thirdBox.height + 8, { steps: 12 });
  await page.waitForTimeout(300);
  await shot(page, 'roadmap-drag-1280.png');
  await page.mouse.up();
  await page.waitForTimeout(600);
}

// Editor dialog + validation error at 1280
await page.getByRole('button', { name: /legg til punkt/i }).click();
await page.locator('#roadmap-title').fill('');
await page.getByRole('button', { name: /^Legg til$/ }).click();
await page.waitForTimeout(300);
await shot(page, 'roadmap-editor-dialog-validation-1280.png');
await page.getByRole('button', { name: /avbryt/i }).click();

// Save success toast
await page.getByRole('button', { name: /legg til punkt/i }).click();
await page.locator('#roadmap-title').fill('Toast-test punkt');
await page.locator('#roadmap-body').fill('Lagres for toast.');
await page.getByRole('button', { name: /^Legg til$/ }).click();
await page.waitForTimeout(900);
await shot(page, 'toast-save-success-1280.png');

// Changelog with draft + published
await openAdminTab(page, 'Endringslogg');
await page.getByRole('button', { name: /legg til endring/i }).click();
await page.locator('#changelog-title').fill('Publisert endring');
await page.locator('#changelog-body').fill('Dette er publisert.');
await page.getByRole('button', { name: /^Publiser$/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /legg til endring/i }).click();
await page.locator('#changelog-title').fill('Utkast til senere');
await page.locator('#changelog-body').fill('Skjult utkast.');
await page.getByRole('checkbox', { name: /publiser med lagring/i }).setChecked(false);
await page.getByRole('button', { name: /lagre utkast/i }).click();
await page.waitForTimeout(800);
await shot(page, 'changelog-list-1280.png');

// Publish via eye icon (no separate confirm dialog)
await page.getByLabel('Publiser').first().click();
await page.waitForTimeout(700);
await shot(page, 'changelog-publish-confirm-1280.png');

// Dark mode roadmap
await page.addInitScript(() => document.documentElement.classList.add('dark'));
await openAdminTab(page, 'Veikart');
await shot(page, 'roadmap-dark-1280.png');

await desktop.close();

// Mobile context
const iphone = devices['iPhone 12'];
const mobile = await browser.newContext({ ...iphone });
const mpage = await mobile.newPage();
await login(mpage);
await openAdminTab(mpage, 'Veikart');
await shot(mpage, 'roadmap-list-390.png');
await mpage.getByRole('button', { name: /legg til punkt/i }).click();
await mpage.locator('#roadmap-title').fill('');
await mpage.getByRole('button', { name: /^Legg til$/ }).click();
await mpage.waitForTimeout(300);
await shot(mpage, 'roadmap-editor-drawer-validation-390.png');
await openAdminTab(mpage, 'Endringslogg');
await shot(mpage, 'changelog-list-390.png');

await mobile.close();
await browser.close();
