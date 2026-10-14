import { test, expect, type Page } from '@playwright/test';

/**
 * A9: the Reels vote screen must never clip the description or push the vote
 * buttons outside the viewport, on phones and tablets alike.
 */
const VIEWPORTS = [
  { name: '360x640', width: 360, height: 640 },
  { name: '360x740', width: 360, height: 740 },
  { name: '375x667', width: 375, height: 667 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
];

const DESCRIPTION_FADE_PX = 40;

async function openFirstReelVote(page: Page) {
  await page.getByRole('button', { name: 'Åpne Reels' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reels' });
  await expect(dialog).toBeVisible();

  if (await dialog.getByRole('heading', { name: 'Ingen Reels publisert ennå' }).isVisible().catch(() => false)) {
    return null;
  }

  const activeCard = dialog.locator('[aria-current="true"]').first();
  await activeCard.getByRole('button', { name: 'Trykk for å stemme' }).click();
  return { dialog, activeCard };
}

test.describe('Reels mobile/tablet layout', () => {
  for (const viewport of VIEWPORTS) {
    test(`vote buttons stay in view at ${viewport.name}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard/utforsk');
      await expect(page.getByRole('heading', { name: 'Utforsk saker' })).toBeVisible({
        timeout: 90_000,
      });

      const opened = await openFirstReelVote(page);
      if (!opened) {
        test.skip(true, 'Ingen publiserte Reels i testdata');
        return;
      }

      const { activeCard } = opened;
      const voteFace = activeCard.getByTestId('reel-vote-face');
      await expect(voteFace).toBeVisible();

      for (const label of ['Nei', 'Tilbake', 'Ja']) {
        const button = voteFace.getByRole('button', { name: label, exact: true });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box, `${label} mangler boks`).not.toBeNull();
        if (!box) continue;
        expect(box.x, `${label} venstre kant`).toBeGreaterThanOrEqual(-1);
        expect(box.y, `${label} toppkant`).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width, `${label} høyre kant`).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height, `${label} bunnkant`).toBeLessThanOrEqual(viewport.height + 1);
      }

      const description = voteFace.getByTestId('reel-description');
      if ((await description.count()) > 0) {
        const size = await description.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight + DESCRIPTION_FADE_PX);
      }
    });
  }
});
