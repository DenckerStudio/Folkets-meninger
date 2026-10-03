import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const ARTIFACTS = '/opt/cursor/artifacts';

test.describe('AI-chat orb overlay', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('floating orb opens the chat panel on a normal dashboard page', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger' })).toBeVisible();

    const orb = page.getByRole('button', { name: 'Åpne AI-chat' });
    await expect(orb).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'AI-chat' })).toHaveCount(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    await page.screenshot({
      path: `${ARTIFACTS}/chat-orb-closed.png`,
    });

    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI-chat', exact: true })).toBeVisible();
    await expect(page.getByText('Logg inn for å bruke AI-chat')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Logg inn' })).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-open.png`,
    });
  });

  test('login next preserves chat+sak deep link', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/utforsk?chat=1&sak=200417');
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible({ timeout: 90_000 });
    const login = panel.getByRole('link', { name: 'Logg inn' });
    await expect(login).toBeVisible();
    const href = await login.getAttribute('href');
    expect(href).toBeTruthy();
    const url = new URL(href!, 'http://localhost');
    expect(url.pathname).toBe('/auth/login');
    const next = url.searchParams.get('next');
    expect(next).toBeTruthy();
    expect(next).toContain('/dashboard/utforsk');
    expect(next).toContain('chat=1');
    expect(next).toContain('sak=200417');
  });

  test('legacy /dashboard/chat opens the overlay on Utforsk', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/chat');
    await expect(page).toHaveURL(/\/dashboard\/utforsk(\?|$)/);
    await expect(page.locator('[data-chat-panel]')).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'AI-chat', exact: true })).toBeVisible();
  });

  test('floating orb mounts on Utforsk and opens the panel', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/utforsk');
    await expect(page.getByRole('heading', { name: 'Utforsk saker' })).toBeVisible({ timeout: 90_000 });

    const orb = page.getByRole('button', { name: 'Åpne AI-chat' });
    await expect(orb).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'AI-chat' })).toHaveCount(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    await page.screenshot({
      path: `${ARTIFACTS}/chat-orb-utforsk-closed.png`,
    });

    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI-chat', exact: true })).toBeVisible();
    await expect(page.getByText('Logg inn for å bruke AI-chat')).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-utforsk-open.png`,
    });
  });
});
