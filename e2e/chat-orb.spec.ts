import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const ARTIFACTS = '/opt/cursor/artifacts';

/** Panel mounts immediately with "Laster chat…"; wait until the guest gate is settled. */
async function waitForGuestChatPanel(page: Page) {
  const panel = page.locator('[data-chat-panel]');
  await expect(panel).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByRole('link', { name: 'Logg inn' })).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByText('Laster chat…')).toHaveCount(0);
  return panel;
}

test.describe('Chat orb overlay', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('guests do not see the Stemme+ pill; chat opens via deep link', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger', exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Åpne Stemme+' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'Chat' })).toHaveCount(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    await page.goto('/dashboard/avstemninger?chat=1');
    const panel = await waitForGuestChatPanel(page);
    await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible();
    await expect(panel.getByText('Logg inn for å bruke chat')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriv' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Rettskriving' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Hent sakskontekst' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Finn oppdaterte kilder' })).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-open.png`,
    });
  });

  test('Stemme+ no-key panel hides rettskriv/kilder', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/api/stemme-plus/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tier: 'stemme_plus',
          has_byok: false,
          monthly_price_nok: 59,
          checkout_configured: false,
        }),
      });
    });

    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger', exact: true })).toBeVisible();

    const orb = page.getByRole('button', { name: 'Åpne Stemme+' });
    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriv' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Rettskriving' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Finn oppdaterte kilder' })).toHaveCount(0);
    await expect(page.getByText('Lagre en LLM-nøkkel først')).toBeVisible();
    await expect(panel.getByText('Hei — hvordan kan jeg hjelpe?')).toHaveCount(0);

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-actions-open.png`,
    });
  });

  test('Stemme+ ready chat shows assistant card welcome without rettskriv/kilder', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/api/stemme-plus/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tier: 'stemme_plus',
          has_byok: true,
          monthly_price_nok: 59,
          checkout_configured: false,
        }),
      });
    });

    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Åpne Stemme+' }).click();
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Hei — hvordan kan jeg hjelpe?')).toBeVisible();
    await expect(panel.locator('[data-chat-suggestion]').first()).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriv' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Finn oppdaterte kilder' })).toHaveCount(0);
    await expect(panel.getByPlaceholder('Spør om en sak eller dokumenter…')).toBeVisible();

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-assistant-card-welcome.png`,
    });
  });

  test('composer surfaces Rettskriv and Finn oppdaterte kilder for Stemme+', async ({ page }) => {
    test.setTimeout(90_000);
    await page.route('**/api/stemme-plus/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tier: 'stemme_plus',
          has_byok: true,
          monthly_price_nok: 59,
          checkout_configured: false,
        }),
      });
    });
    await page.route('**/api/chat/rettskriving', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          original: 'Stortinget burde vurdere forslaget om klima.',
          context: 'diskusjon',
          instruction: 'Rett stavemåte, grammatikk og tydelighet. Behold brukerens mening.',
          published: false,
          mode: 'corrected',
          corrected: 'Stortinget bør vurdere forslaget om klima.',
          notes: 'Byttet burde til bør.',
        }),
      });
    });

    await page.goto('/dashboard/folkets-meninger');
    await page.getByRole('button', { name: 'Del din mening' }).first().click();
    const composer = page.locator('[data-composer][data-expanded="true"]');
    await expect(composer).toBeVisible({ timeout: 90_000 });

    await expect(composer.locator('[data-composer-assists="ready"]')).toBeVisible({ timeout: 90_000 });
    await expect(composer.getByRole('button', { name: 'Rettskriv' })).toBeVisible();
    await expect(composer.getByRole('button', { name: 'Finn oppdaterte kilder' })).toBeVisible();

    await composer.locator('#opinion-body').fill(
      'Stortinget burde vurdere forslaget om klima i denne saken nå.',
    );
    await composer.getByRole('button', { name: 'Rettskriv' }).click();
    await composer.getByRole('button', { name: 'Rett begrunnelsen' }).click();
    await expect(composer.locator('[data-rettskriving-result="corrected"]')).toBeVisible();
    await expect(composer.getByText('Stortinget bør vurdere forslaget om klima.')).toBeVisible();

    await composer.getByRole('button', { name: 'Finn oppdaterte kilder' }).click();
    await expect(composer.getByPlaceholder('Søk etter oppdaterte kilder…')).toBeVisible();

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({
      path: `${ARTIFACTS}/composer-stemme-assists.png`,
    });
  });

  test('login next preserves chat+sak deep link', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/utforsk?chat=1&sak=200417');
    const panel = await waitForGuestChatPanel(page);
    const login = panel.getByRole('link', { name: 'Logg inn' });
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
    await waitForGuestChatPanel(page);
    await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible();
  });

  test('Utforsk hides Stemme+ pill for guests; chat via deep link', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/utforsk');
    await expect(page.getByRole('heading', { name: 'Utforsk saker' })).toBeVisible({ timeout: 90_000 });

    await expect(page.getByRole('button', { name: 'Åpne Stemme+' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'Chat' })).toHaveCount(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    await page.goto('/dashboard/utforsk?chat=1');
    const panel = await waitForGuestChatPanel(page);
    await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible();
    await expect(panel.getByText('Logg inn for å bruke chat')).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-utforsk-open.png`,
    });
  });
});
