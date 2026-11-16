import { test, expect } from '@playwright/test';

const routes = { minSide: '/dashboard/min-side' } as const;

test.describe('Min side navigasjon', () => {
  test('gjester ser ikke Min side i toppmenyen på forsiden', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('navigation', { name: 'Hovedmeny' });
    await expect(header.getByRole('link', { name: 'Min side' })).toHaveCount(0);
  });

  test('innlogging kreves for Min side', async ({ page }) => {
    await page.goto(routes.minSide);
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('legacy tab-parameter omdirigeres til ny rute', async ({ page }) => {
    await page.goto(`${routes.minSide}?tab=varsler`);
    await expect(page).toHaveURL(/auth\/login/);
  });
});