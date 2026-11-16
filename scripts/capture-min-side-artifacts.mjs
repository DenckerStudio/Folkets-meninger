/**
 * Playwright captures of Min side + header for PR artifacts.
 * Requires dev server. Optional login via E2E_MIN_SIDE_EMAIL / E2E_MIN_SIDE_PASSWORD.
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS = '/opt/cursor/artifacts';
const PREFIX = process.argv[2] || 'after';
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

const EMAIL = process.env.E2E_MIN_SIDE_EMAIL ?? 'e2e-min-side+cloudagent@folkets-meninger.test';
const PASSWORD = process.env.E2E_MIN_SIDE_PASSWORD ?? 'E2eMinSide!CloudAgent2026';

async function ensureTestUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn('Missing Supabase admin env — login screenshots may be skipped.');
    return false;
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing.data.users.find((u) => u.email === EMAIL);
  if (!found) {
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error) {
      console.warn('Could not create e2e user:', created.error.message);
      return false;
    }
  }
  return true;
}

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByLabel(/e-post/i).fill(EMAIL);
  await page.getByLabel(/passord/i).fill(PASSWORD);
  await page.getByRole('button', { name: /logg inn/i }).click();
  await page.waitForURL(/dashboard\/utforsk|dashboard\/min-side/, { timeout: 60_000 });
}

async function captureViewport(viewport, suffix) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });

  const canLogin = await ensureTestUser();
  if (canLogin) {
    await login(page);
  } else {
    console.warn('Skipping authenticated captures — no admin API');
    await browser.close();
    return;
  }

  await page.goto(`${BASE}/dashboard/min-side`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.getByRole('heading', { name: 'Min side' }).waitFor({ state: 'visible' });
  const minSidePath = path.join(ARTIFACTS, `${PREFIX}_min_side_${suffix}.png`);
  await page.screenshot({ path: minSidePath, fullPage: false });

  await page.goto(`${BASE}/dashboard/utforsk`, { waitUntil: 'domcontentloaded' });
  const header = page.locator('[data-site-chrome]');
  const navPath = path.join(ARTIFACTS, `${PREFIX}_header_nav_${suffix}.png`);
  await header.screenshot({ path: navPath });

  if (viewport.width <= 400) {
    const menuButton = page.getByRole('button', { name: /Åpne meny|Meny/i }).first();
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
      const drawer = page.getByRole('dialog', { name: 'Navigasjonsmeny' });
      await drawer.waitFor({ state: 'visible' });
      const mobileMenuPath = path.join(ARTIFACTS, `${PREFIX}_mobile_menu_${suffix}.png`);
      await drawer.screenshot({ path: mobileMenuPath });
      console.log(mobileMenuPath);
    }
  }

  console.log(minSidePath);
  console.log(navPath);
  await browser.close();
}

await captureViewport({ width: 1440, height: 900 }, 'desktop_1440');
await captureViewport({ width: 390, height: 844 }, 'mobile_390');