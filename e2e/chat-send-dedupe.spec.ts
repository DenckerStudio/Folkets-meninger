import { test, expect, type Page } from '@playwright/test';

function uiMessageStream(text: string): string {
  const chunks = [
    { type: 'start' },
    { type: 'start-step' },
    { type: 'text-start', id: '0' },
    { type: 'text-delta', id: '0', delta: text },
    { type: 'text-end', id: '0' },
    { type: 'finish-step' },
    { type: 'finish' },
  ];
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
}

async function mockStemmePlusReady(page: Page) {
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
  await page.route('**/api/chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: uiMessageStream('Dette er et kort systemsvar.'),
    });
  });
}

test.describe('Stemme+ chat send', () => {
  test('a rapid double Enter sends the user message only once', async ({ page }) => {
    test.setTimeout(90_000);
    await mockStemmePlusReady(page);

    await page.goto('/dashboard/avstemninger');
    await page.getByRole('button', { name: 'Åpne chat' }).click();
    const panel = page.locator('[data-chat-panel]');
    await expect(panel).toBeVisible();
    const textarea = panel.getByPlaceholder('Spør om en sak eller dokumenter…');
    await expect(textarea).toBeVisible();

    await textarea.fill('Hva mener folk om klima?');

    // Two Enter keydowns in the same task: the React closure still sees the
    // stale (not-busy) state, so a naive handler fires two sends.
    await textarea.evaluate((el) => {
      const options = { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', options));
      el.dispatchEvent(new KeyboardEvent('keydown', options));
    });

    await expect(panel.getByText('Dette er et kort systemsvar.')).toBeVisible();

    const userBubbles = panel.locator('article', { hasText: 'Hva mener folk om klima?' });
    await expect(userBubbles).toHaveCount(1);
  });
});
