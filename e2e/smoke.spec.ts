import { test, expect } from '@playwright/test';

test.describe('Folkets Stemme smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Folkets Stemme|Slik fungerer det/i }).first()).toBeVisible();
  });

  test('om-oss mentions login not BankID', async ({ page }) => {
    await page.goto('/om-oss');
    await expect(page.getByText(/BankID kommer senere/i)).toBeVisible();
  });

  test('public sak route responds', async ({ page }) => {
    const res = await page.goto('/dashboard/sak/200329');
    expect(res?.status()).toBeLessThan(500);
  });

  test('forum redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard/forum');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('complete-profile page explains public forum identity', async ({ page }) => {
    await page.goto('/auth/complete-profile');
    await expect(page.getByText(/Foruminnlegg er offentlige/i)).toBeVisible();
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
