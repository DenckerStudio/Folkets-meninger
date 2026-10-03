import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ARTIFACTS = '/opt/cursor/artifacts';

test.describe('AI-chat orb overlay', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('floating orb opens the chat panel on a normal dashboard page', async ({ page }) => {
    await page.goto('/dashboard/folkets-meninger');
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();

    const orb = page.locator('[data-chat-orb]');
    await expect(orb).toBeVisible();
    await expect(orb).toHaveAttribute('data-open', 'false');
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'AI-chat' })).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/chat-orb-closed.png`,
      animations: 'disabled',
    });

    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI-chat' })).toBeVisible();
    await expect(page.getByText('Logg inn for å bruke AI-chat')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Logg inn' })).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-open.png`,
      animations: 'disabled',
    });
  });

  test('legacy /dashboard/chat is not a sidebar destination and opens the panel', async ({ page }) => {
    await page.goto('/dashboard/chat');
    await expect(page).toHaveURL(/\/dashboard\/utforsk/);
    await expect(page.locator('[data-chat-panel]')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'AI-chat' })).toBeVisible();
  });
});
