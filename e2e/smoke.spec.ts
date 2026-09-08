import { test, expect } from '@playwright/test';

test.describe('Folkets Stemme smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Folkets Stemme|Slik fungerer det/i }).first()).toBeVisible();
  });

  test('landing about section does not mention BankID or MinID', async ({ page }) => {
    await page.goto('/#om-oss');
    await expect(page.getByText(/Om Folkets Stemme/i)).toBeVisible();
    await expect(page.getByText(/BankID|MinID/i)).toHaveCount(0);
  });

  test('public sak route responds', async ({ page }) => {
    const res = await page.goto('/dashboard/sak/200329');
    expect(res?.status()).toBeLessThan(500);
  });

  test('legacy forum path redirects toward folkets meninger or login', async ({ page }) => {
    await page.goto('/dashboard/forum');
    await expect(page).toHaveURL(/auth\/login|dashboard\/folkets-meninger/);
  });

  test('folkets meninger list is public', async ({ page }) => {
    const res = await page.goto('/dashboard/folkets-meninger');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();
  });

  test('imot fills the compact bar before the stance modal expands', async ({ page }) => {
    await page.goto('/dashboard/folkets-meninger');
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();
    const modal = page.locator('[data-stance-modal]');
    await expect(modal).toHaveAttribute('data-phase', 'idle');
    await modal.locator('[data-stance-choice="imot"]').click();
    await expect(modal).toHaveAttribute('data-phase', 'filling');
    await expect(modal).toHaveAttribute('data-phase', 'expanded', { timeout: 2000 });
    await expect(page.getByRole('heading', { name: /Hvorfor imot/i })).toBeVisible();
  });

  test('complete-profile page explains public identity', async ({ page }) => {
    await page.goto('/auth/complete-profile');
    await expect(page.getByText(/Offentlige innspill|fornavn og etternavn/i)).toBeVisible();
  });

  test('horinger list page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/horinger');
    expect(res?.status()).toBeLessThan(500);
  });

  test('public avstemninger page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/avstemninger');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Avstemninger' })).toBeVisible();
  });

  test('cron endpoint rejects missing secret', async ({ request }) => {
    const res = await request.get('/api/cron/sync-issues');
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET is not configured/);
  });
});
