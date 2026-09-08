import { test, expect } from '@playwright/test';

test.describe('Folkets Stemme smoke', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Folkets Stemme|Slik fungerer det/i }).first()).toBeVisible();
  });

  test('landing about section does not mention BankID or MinID', async ({ page }) => {
    await page.goto('/#om-oss');
    await expect(page.getByText(/Om Folkets Stemme/i)).toBeVisible();
    await expect(page.getByText(/BankID|MinID/i)).toHaveCount(0);
  });

  test('public sak route responds', async ({ page }) => {
    const res = await page.goto('/dashboard/sak/200329');
    expect(res?.status()).toBeLessThan(500);
  });

  test('legacy forum path redirects toward folkets meninger or login', async ({ page }) => {
    await page.goto('/dashboard/forum');
    await expect(page).toHaveURL(/auth\/login|dashboard\/folkets-meninger/);
  });

  test('folkets meninger list is public', async ({ page }) => {
    const res = await page.goto('/dashboard/folkets-meninger');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();
  });

  test('composer starts collapsed and expands without the animated stance bar', async ({ page }) => {
    await page.goto('/dashboard/folkets-meninger');
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();
    const composer = page.locator('[data-composer]');
    await expect(composer).toHaveAttribute('data-expanded', 'false');
    await expect(page.locator('[data-stance-modal]')).toHaveCount(0);
    await expect(page.getByText('Borgerinitiativ')).toHaveCount(0);
    await composer.locator('[data-composer-cta="open"]').click();
    await expect(composer).toHaveAttribute('data-expanded', 'true');
    await expect(page.getByText(/Tittel: 5[-–]200 tegn/)).toBeVisible();
    await expect(page.getByText(/Hvert kulepunkt: 12[-–]180 tegn/)).toBeVisible();
    await expect(page.getByLabel('Begrunnelse')).toBeVisible();
    await expect(page.getByText('Velg en sak først, så kan du si For eller Imot.')).toBeVisible();
    await expect(composer.locator('[data-create-stance]')).toHaveCount(0);
    await expect(page.locator('[data-stance-modal]')).toHaveCount(0);
  });

  test('reply stance bar keeps Blank in the white stripe', async ({ page }) => {
    await page.goto('/dashboard/folkets-meninger');
    const replyLink = page.getByRole('link', { name: 'Si For, Blank eller Imot' }).first();
    if ((await replyLink.count()) === 0) {
      test.skip(true, 'No published opinions to reply to');
      return;
    }
    await replyLink.click();
    const modal = page.locator('[data-stance-modal]');
    await expect(modal).toHaveAttribute('data-allow-blank', 'true');
    await expect(modal.locator('[data-stance-choice="blank"]')).toHaveText('Blank');
    const imotBox = await modal.locator('[data-stance-choice="imot"]').boundingBox();
    const blankBox = await modal.locator('[data-stance-choice="blank"]').boundingBox();
    const forBox = await modal.locator('[data-stance-choice="for"]').boundingBox();
    expect(imotBox!.x).toBeLessThan(blankBox!.x);
    expect(blankBox!.x).toBeLessThan(forBox!.x);

    await modal.locator('[data-stance-choice="blank"]').click();
    await expect(modal).toHaveAttribute('data-phase', 'filling');
    await expect(modal).toHaveAttribute('data-phase', 'expanded', { timeout: 2000 });
    await expect(page.getByRole('heading', { name: 'Blank stemme' })).toBeVisible();
    await expect(page.getByText(/Ingen begrunnelse kreves/i)).toBeVisible();
    await expect(modal.locator('textarea')).toHaveCount(0);
  });

  test('sak suggestions appear from the opinion title', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/dashboard/folkets-meninger');
    await expect(page.getByRole('heading', { name: 'Folkets meninger' })).toBeVisible();
    await page.getByRole('button', { name: 'Del din mening' }).click();
    await page.getByPlaceholder('Tittel på meningen').fill('Kollektivtilbud i distriktene');
    await expect(page.getByText('Forslag ut fra tittelen')).toBeVisible({ timeout: 15000 });
    const firstOption = page.locator('[data-sak-option]').first();
    const empty = page.getByText(/Ingen treff på tittelen/);
    await expect(firstOption.or(empty)).toBeVisible({ timeout: 90000 });
    if ((await firstOption.count()) > 0) {
      await page.locator('[data-sak-preview]').first().click();
      await expect(page.locator('[data-sak-preview-frame]')).toBeVisible();
    }
  });

  test('complete-profile page explains public identity', async ({ page }) => {
    await page.goto('/auth/complete-profile');
    await expect(page.getByText(/Offentlige innspill|fornavn og etternavn/i)).toBeVisible();
  });

  test('horinger list page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/horinger');
    expect(res?.status()).toBeLessThan(500);
  });

  test('public avstemninger page loads', async ({ page }) => {
    const res = await page.goto('/dashboard/avstemninger');
    expect(res?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Avstemninger' })).toBeVisible();
  });

  test('cron endpoint rejects missing secret', async ({ request }) => {
    const res = await request.get('/api/cron/sync-issues');
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/CRON_SECRET is not configured/);
  });
});
