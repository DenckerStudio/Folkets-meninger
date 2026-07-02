import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'cursor-sak-rag-test@gmail.com';
const ADMIN_PASSWORD = 'TestSakRag2026!';

test.describe('Sak-RAG v13 admin UI', () => {
  test('admin pipeline shows sak candidates and draft', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/auth/login');
    await page.screenshot({
      path: '/opt/cursor/artifacts/screenshots/sak-rag-01-login.png',
      fullPage: true,
    });

    await page.getByLabel(/e-post/i).fill(ADMIN_EMAIL);
    await page.getByLabel(/passord/i).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /logg inn/i }).click();
    await page.waitForURL(/dashboard/, { timeout: 30000 });

    await page.goto('/dashboard/admin/forum-prompts?tab=pipeline');
    await expect(page.getByText(/Stortingssaker \(RAG v13\)/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Sak-kandidater/i)).toBeVisible();
    await page.screenshot({
      path: '/opt/cursor/artifacts/screenshots/sak-rag-02-admin-pipeline.png',
      fullPage: true,
    });

    await expect(page.getByText(/Utkast til godkjenning/i)).toBeVisible();
    await expect(page.getByText(/verdipapirfondloven/i)).toBeVisible({ timeout: 15000 });
    await page.screenshot({
      path: '/opt/cursor/artifacts/screenshots/sak-rag-03-draft-visible.png',
      fullPage: true,
    });

    await page.goto('/dashboard/sak/200349');
    await expect(page.getByText(/Generer reel-utkast/i)).toBeVisible({ timeout: 60000 });
    await page.screenshot({
      path: '/opt/cursor/artifacts/screenshots/sak-rag-04-sak-admin-button.png',
      fullPage: true,
    });
  });
});
