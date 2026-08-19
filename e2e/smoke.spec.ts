import { test, expect } from '@playwright/test';

test.describe('Folkets Stemme smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Folkets Stemme|Slik fungerer det/i }).first()).toBeVisible();
  });

  test('landing about section mentions login not MinID yet', async ({ page }) => {
    await page.goto('/#om-oss');
    await expect(page.getByText(/MinID kommer senere/i)).toBeVisible();
  });

  test('public sak route responds', async ({ page }) => {
    const res = await page.goto('/dashboard/sak/200329');
    expect(res?.status()).toBeLessThan(500);
  });

  test('legacy forum path redirects toward utforsk or login', async ({ page }) => {
    await page.goto('/dashboard/forum');
    await expect(page).toHaveURL(/auth\/login|dashboard\/utforsk/);
  });

  test('complete-profile redirects to onboarding or login', async ({ page }) => {
    await page.goto('/auth/complete-profile');
    await expect(page).toHaveURL(/auth\/onboarding|auth\/login/);
  });

  test('onboarding page sends guests to login', async ({ page }) => {
    await page.goto('/auth/onboarding');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('horinger list page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/horinger');
    expect(res?.status()).toBeLessThan(500);
  });

  test('cron endpoint rejects missing secret', async ({ request }) => {
    const res = await request.get('/api/cron/sync-issues');
    expect(res.status()).toBe(401);
  });
});
