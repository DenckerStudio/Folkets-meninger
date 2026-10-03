import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

const ARTIFACTS = '/opt/cursor/artifacts';

/** Panel mounts immediately with "Laster AI-chat…"; wait until the guest gate is settled. */
async function waitForGuestChatPanel(page: Page) {
  const panel = page.locator('[data-chat-panel]');
  await expect(panel).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByRole('link', { name: 'Logg inn' })).toBeVisible({ timeout: 90_000 });
  await expect(panel.getByText('Laster AI-chat…')).toHaveCount(0);
  return panel;
}

test.describe('AI-chat orb overlay', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('floating orb opens the chat panel on a normal dashboard page', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger', exact: true })).toBeVisible();

    const orb = page.getByRole('button', { name: 'Åpne AI-chat' });
    await expect(orb).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Dashbordmeny' }).getByRole('link', { name: 'AI-chat' })).toHaveCount(0);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    await page.screenshot({
      path: `${ARTIFACTS}/chat-orb-closed.png`,
    });

    await orb.click();

    const panel = await waitForGuestChatPanel(page);
    await expect(page.getByRole('heading', { name: 'AI-chat', exact: true })).toBeVisible();
    await expect(panel.getByText('Logg inn for å bruke AI-chat')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriving' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Hent sakskontekst' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Finn oppdaterte kilder' })).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-open.png`,
    });
  });

  test('Stemme+ panel shows rettskriving and source actions without a chat turn', async ({ page }) => {
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

    const orb = page.getByRole('button', { name: 'Åpne AI-chat' });
    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rettskriving' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Hent sakskontekst' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Finn oppdaterte kilder' })).toBeVisible();
    await expect(panel.getByPlaceholder('Lim inn eller skriv en kladd. Vi publiserer den ikke.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Sjekk kladden' })).toBeVisible();
    await expect(page.getByText('Lagre en LLM-nøkkel først')).toBeVisible();

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-actions-open.png`,
    });

    await expect(
      panel.getByText('Uten nøkkel viser vi bare instruksjonen. Vi later ikke som en modell har rettet teksten.'),
    ).toBeVisible();

    await page.route('**/api/chat/rettskriving', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          original: 'Stortinget bør vurdere forslaget om klima.',
          context: 'annet',
          instruction: 'Rett stavemåte, grammatikk og tydelighet. Behold brukerens mening.',
          published: false,
          mode: 'instruction',
          corrected: null,
          notes: null,
        }),
      });
    });

    await panel.getByPlaceholder('Lim inn eller skriv en kladd. Vi publiserer den ikke.').fill(
      'Stortinget bør vurdere forslaget om klima.',
    );
    await panel.getByRole('button', { name: 'Sjekk kladden' }).click();
    await expect(panel.locator('[data-rettskriving-result="instruction"]')).toBeVisible();
    await expect(panel.getByText('Ingen LLM-retting uten nøkkel')).toBeVisible();
    await expect(panel.locator('[data-rettskriving-result="corrected"]')).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-rettskriving-no-key.png`,
    });

    await panel.getByRole('button', { name: 'Finn oppdaterte kilder' }).click();
    await expect(panel.getByPlaceholder('Søk etter oppdaterte kilder…')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Søk' })).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-actions-sources.png`,
    });
  });

  test('Stemme+ panel retrieves sak context without an LLM', async ({ page }) => {
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
    await page.route('**/api/chat/sak-context', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          issue: {
            id: '200365',
            title: 'Representantforslag om vektgrense',
            summary: null,
            henvisning: null,
            ferdigbehandlet: false,
          },
          summary: 'AI-sammendrag fra saksdokumentene.',
          chunks: [{ documentId: 'd1', chunkIndex: 0, content: 'Utdrag om vektgrense for førerkort.' }],
          note: null,
          empty: false,
        }),
      });
    });

    await page.goto('/dashboard/utforsk?chat=1&sak=200365');
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible({ timeout: 90_000 });
    await expect(panel.getByRole('button', { name: 'Hent sakskontekst' })).toBeVisible();
    await expect(panel.getByPlaceholder('Sak-id eller tittel')).toHaveValue('200365');
    await expect(panel.getByText('Ingen språkmodell')).toBeVisible();

    await page.addStyleTag({
      content:
        'nextjs-portal { display: none !important; } html, body, button, input, p, h2 { font-family: ui-sans-serif, system-ui, sans-serif !important; }',
    });
    await page.screenshot({
      path: `${ARTIFACTS}/hent-sakskontekst-action.png`,
    });

    await panel.getByRole('button', { name: 'Hent', exact: true }).click();
    await expect(panel.locator('[data-sak-context-result="ready"]')).toBeVisible();
    await expect(panel.getByText('AI-sammendrag fra saksdokumentene.')).toBeVisible();
    await expect(panel.getByText('Utdrag om vektgrense for førerkort.')).toBeVisible();
    await expect(panel.locator('[data-sak-context-result="empty"]')).toHaveCount(0);

    await page.screenshot({
      path: `${ARTIFACTS}/hent-sakskontekst-result.png`,
    });
  });

  test('orb on a sak page defaults Hent sakskontekst to that id', async ({ page }) => {
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

    await page.goto('/dashboard/sak/200365');
    const orb = page.getByRole('button', { name: 'Åpne AI-chat' });
    await expect(orb).toBeVisible({ timeout: 90_000 });
    await orb.click();

    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Hent sakskontekst' })).toBeVisible();
    await expect(panel.getByPlaceholder('Sak-id eller tittel')).toHaveValue('200365');

    await page.addStyleTag({
      content:
        'nextjs-portal { display: none !important; } html, body, button, input, p, h2 { font-family: ui-sans-serif, system-ui, sans-serif !important; }',
    });
    await page.screenshot({
      path: `${ARTIFACTS}/hent-sakskontekst-sak-page-default.png`,
    });
  });

  test('Stemme+ panel with BYOK shows a corrected draft from the API', async ({ page }) => {
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
          context: 'annet',
          instruction: 'Rett stavemåte, grammatikk og tydelighet. Behold brukerens mening.',
          published: false,
          mode: 'corrected',
          corrected: 'Stortinget bør vurdere forslaget om klima.',
          notes: 'Byttet burde til bør.',
        }),
      });
    });

    await page.goto('/dashboard/avstemninger');
    await expect(page.getByRole('heading', { name: 'Avstemninger', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Åpne AI-chat' }).click();
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Rett kladden' })).toBeVisible();
    await expect(
      panel.getByText('Vi retter kladden med nøkkelen din. Kladden publiseres ikke.'),
    ).toBeVisible();

    await panel.getByPlaceholder('Lim inn eller skriv en kladd. Vi publiserer den ikke.').fill(
      'Stortinget burde vurdere forslaget om klima.',
    );
    await panel.getByRole('button', { name: 'Rett kladden' }).click();
    await expect(panel.locator('[data-rettskriving-result="corrected"]')).toBeVisible();
    await expect(panel.getByText('Rettet med nøkkelen din')).toBeVisible();
    await expect(panel.getByText('Stortinget bør vurdere forslaget om klima.')).toBeVisible();
    await expect(panel.getByText('Merknader: Byttet burde til bør.')).toBeVisible();

    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-rettskriving-keyed.png`,
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

    const panel = await waitForGuestChatPanel(page);
    await expect(page.getByRole('heading', { name: 'AI-chat', exact: true })).toBeVisible();
    await expect(panel.getByText('Logg inn for å bruke AI-chat')).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/chat-panel-utforsk-open.png`,
    });
  });
});
