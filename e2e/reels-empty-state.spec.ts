import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ARTIFACTS = '/opt/cursor/artifacts';

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } });

test.describe('Utforsk Reels empty chrome', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('Reels modal uses shared EmptyState and keeps the orb', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/utforsk');
    await expect(page.getByRole('heading', { name: 'Utforsk saker' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('button', { name: 'Åpne chat' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'Chat' })).toHaveCount(0);
    await expect(page.getByText(/BankID|MinID/i)).toHaveCount(0);

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({ path: `${ARTIFACTS}/tip_utforsk_orb_closed.png` });

    await page.getByRole('button', { name: 'Åpne Reels' }).click();
    await expect(page.getByRole('heading', { name: 'Ingen Reels publisert ennå' })).toBeVisible();
    await expect(
      page.getByRole('status').getByText(/Systemgenerert fra stortingssaker/),
    ).toBeVisible();
    await expect(page.getByRole('status').getByText(/ja\/nei\/blank/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Åpne chat' })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACTS}/tip_utforsk_reels_empty_state.png` });

    await page.getByRole('button', { name: 'Åpne chat' }).click();
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Logg inn' })).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByText('Laster chat…')).toHaveCount(0);
    await expect(panel.getByText('Logg inn for å bruke chat')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriving' })).toHaveCount(0);
    await page.screenshot({ path: `${ARTIFACTS}/tip_utforsk_reels_orb_login_gate.png` });
  });
});
