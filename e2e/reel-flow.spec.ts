import { test, expect } from '@playwright/test';

test.describe('Reel flow UI', () => {
  test('landing roadmap documents points tiers', async ({ page }) => {
    await page.goto('/#veien-videre');
    await expect(page.getByText(/Poengnivåer/i)).toBeVisible();
    await expect(page.getByText(/Pålitelig \(750\)/i)).toBeVisible();
    await expect(page.getByText(/Kurator \(2 000\)/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Opprett konto/i }).first()).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/landing-roadmap.png', fullPage: true });
  });

  test('foresla-reel redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/forum/foresla-reel');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('spesielle saker redirects to login preserving destination', async ({ page }) => {
    await page.goto('/dashboard/forum/spesielle-saker');
    await expect(page).toHaveURL(/auth\/login/);
    await expect(page.url()).toContain('spesielle-saker');
  });

  test('public profile shows points progress when user exists', async ({ page }) => {
    const res = await page.goto('/profil/8813b8dd-0c44-4524-8ebf-f20858bdd0cd');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByText(/Offentlig forumprofil/i)).toBeVisible();
    await expect(page.locator('dt', { hasText: 'Poeng' }).first()).toBeVisible();
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/public-profile-points.png', fullPage: true });
  });
});
