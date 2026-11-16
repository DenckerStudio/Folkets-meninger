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
const routesMinSide = '/dashboard/min-side';

const EMAIL = process.env.E2E_MIN_SIDE_EMAIL ?? 'e2e.minside.cloudagent@example.com';
const PASSWORD = process.env.E2E_MIN_SIDE_PASSWORD ?? 'E2eMinSide!CloudAgent2026';

async function ensureTestUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    console.warn('Missing Supabase anon env — login screenshots may be skipped.');
    return false;
  }
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (!signIn.error) return true;
  console.warn('E2E-bruker mangler eller feil passord — prøver UI-innlogging:', signIn.error.message);
  return true;
}

async function login(page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error('missing anon key');
  const anon = createClient(url, anonKey);
  const { data, error } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) {
    throw new Error(error?.message ?? 'login failed');
  }

  const projectRef = new URL(url).hostname.split('.')[0];
  const cookieBase = {
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  };
  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: 'bearer',
        user: data.session.user,
      }),
      ...cookieBase,
    },
  ]);

  await page.goto(`${BASE}/dashboard/min-side`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('/auth/login')) {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/e-post/i).fill(EMAIL);
    await page.getByLabel(/passord/i).fill(PASSWORD);
    await page.getByRole('button', { name: /logg inn/i }).click();
    await page.waitForURL(/dashboard\//, { timeout: 60_000 });
  }
}

async function captureViewport(viewport, suffix) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });

  try {
    await ensureTestUser();
    await login(page);
  } catch (error) {
    console.warn('Autentisering feilet — tar skjermbilde av innloggingsgate:', error);
    await page.goto(`${BASE}${routesMinSide}`, { waitUntil: 'domcontentloaded' });
    const gatePath = path.join(ARTIFACTS, `${PREFIX}_min_side_login_gate_${suffix}.png`);
    await page.screenshot({ path: gatePath, fullPage: false });
    console.log(gatePath);
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