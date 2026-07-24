import { test, expect } from '@playwright/test';

test.describe('Politiker profiles', () => {
  test('Jonas Gahr Støre profile loads with navigation', async ({ page }) => {
    const res = await page.goto('/dashboard/politikere/JGS');
    expect(res?.status()).toBeLessThan(500);

    await expect(page.getByRole('heading', { name: /Jonas Gahr Støre/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Politikerseksjoner' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Forslag/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Temaer/i })).toBeVisible();
  });

  test('politiker with representantforslag shows sak list', async ({ page }) => {
    await page.goto('/dashboard/politikere/GEIRAJ?tab=forslag');
    await expect(page.getByRole('heading', { name: /Geir Jørgensen/i })).toBeVisible();
    await expect(page.getByText(/Representantforslag der/i)).toBeVisible();
    const sakLinks = page.locator('a[href^="/dashboard/sak/"]');
    await expect(sakLinks.first()).toBeVisible({ timeout: 15_000 });
  });

  test('politician status API returns JSON for anonymous users', async ({ request }) => {
    const res = await request.get('/api/user/politician-status');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toEqual({ isVerified: false });
  });

  test('politician response API rejects unauthenticated posts', async ({ request }) => {
    const res = await request.post('/api/politician/response', {
      data: { stortinget_issue_id: '200027', content: 'Test' },
    });
    expect(res.status()).toBe(401);
  });

  test('sak page shows history back button', async ({ page }) => {
    await page.goto('/dashboard/forum');
    await page.goto('/dashboard/sak/200027');
    await expect(page.getByRole('button', { name: 'Tilbake' })).toBeVisible();
  });
});
