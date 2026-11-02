/**
 * Capture poll UI samples from production server (next start).
 * Empty list: avstemninger-{360|390|desktop}-{light|dark}.png
 * Retired notice: {poll-detail|del|embed}-{360|desktop}-{light|dark}.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const SYSTEM_POLL_SHARE_RETIRED_TITLE = 'Denne avstemningen er avviklet';
const SYSTEM_POLL_SHARE_RETIRED_LEAD =
  'Denne avstemningstypen er tatt ut av appen. Du kan lese saker og dele meninger på Folkets Meninger.';

const baseUrl = process.env.CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000';
const outDir = join(process.cwd(), 'docs/empty-poll-samples');

function loadEnvLocal() {
  for (const file of ['.env.test', '.env.local']) {
    try {
      const raw = readFileSync(join(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    } catch {
      /* optional */
    }
  }
}

async function resolveSystemPollId() {
  if (process.env.POLL_RETIRED_SAMPLE_ID?.trim()) {
    return process.env.POLL_RETIRED_SAMPLE_ID.trim();
  }
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error('Set POLL_RETIRED_SAMPLE_ID or NEXT_PUBLIC_SUPABASE_* in .env.local');
  }
  const res = await fetch(
    `${url}/rest/v1/polls?select=id&track=eq.system&status=in.(open,closed)&order=created_at.desc&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Failed to list system poll: ${res.status}`);
  const rows = await res.json();
  const id = rows?.[0]?.id;
  if (!id) throw new Error('No open/closed system poll for retired capture');
  return String(id);
}

const emptyViewports = [
  { name: '360', width: 360, height: 800 },
  { name: '390', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

const retiredViewports = [
  { name: '360', width: 360, height: 800 },
  { name: 'desktop', width: 1280, height: 900 },
];

async function capturePage(page, url, waitForText, file) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText(waitForText).first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote', file);
}

async function captureRetiredFallback(page, variant, theme, vp, file) {
  const cssLinks = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((nodes) => nodes.map((n) => n.href));

  const linkHtml = cssLinks.map((href) => `<link rel="stylesheet" href="${href}" />`).join('\n');
  const cta =
    variant === 'embed'
      ? `<a href="${baseUrl}/dashboard/utforsk" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground">Utforsk saker</a>`
      : `<a href="${baseUrl}/dashboard/utforsk" class="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground">Utforsk saker</a>`;

  const bare = variant === 'embed';
  const noticeInner = `
    <section class="space-y-4 ${bare ? '' : 'rounded-3xl border border-border bg-card shadow-sm p-4 sm:p-6'}">
      <h2 class="text-lg sm:text-xl font-bold text-foreground">${SYSTEM_POLL_SHARE_RETIRED_TITLE}</h2>
      <p class="text-sm text-muted-foreground">${SYSTEM_POLL_SHARE_RETIRED_LEAD}</p>
      <div class="pt-2">${cta}</div>
    </section>`;

  let body = '';
  if (variant === 'poll-detail') {
    body = `<div class="bg-background p-4"><div class="mx-auto max-w-3xl">${noticeInner}</div></div>`;
  } else if (variant === 'del') {
    body = `<div class="bg-background p-4"><div class="mx-auto max-w-2xl space-y-6"><header><span class="text-lg font-extrabold text-brand">Folkets Meninger</span></header>${noticeInner}</div></div>`;
  } else {
    body = `<div class="bg-background p-3"><div class="mx-auto w-full max-w-xl border border-border bg-card p-4 rounded-xl">${noticeInner}</div></div>`;
  }

  await page.setContent(
    `<!DOCTYPE html><html lang="nb" class="${theme === 'dark' ? 'dark' : ''}"><head>${linkHtml}</head><body>${body}</body></html>`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: file, fullPage: false });
  console.log('wrote (fallback)', file);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const name of [
    'utforsk-360-light.png',
    'utforsk-360-dark.png',
    'utforsk-390-light.png',
    'utforsk-390-dark.png',
    'utforsk-desktop-light.png',
    'utforsk-desktop-dark.png',
  ]) {
    try {
      unlinkSync(join(outDir, name));
    } catch {
      /* gone */
    }
  }

  const pollId = await resolveSystemPollId();
  const browser = await chromium.launch();
  const retiredTitle = SYSTEM_POLL_SHARE_RETIRED_TITLE;

  for (const theme of ['light', 'dark']) {
    for (const vp of emptyViewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        colorScheme: theme,
      });
      const page = await context.newPage();
      await capturePage(
        page,
        `${baseUrl}/dashboard/avstemninger`,
        'Ingen avstemninger er publisert ennå',
        join(outDir, `avstemninger-${vp.name}-${theme}.png`),
      );
      await context.close();
    }

    const styleContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
    });
    const stylePage = await styleContext.newPage();
    await stylePage.goto(`${baseUrl}/dashboard/avstemninger`, { waitUntil: 'domcontentloaded' });

    for (const vp of retiredViewports) {
      const retiredPages = [
        { slug: 'poll-detail', path: `/dashboard/avstemninger/${encodeURIComponent(pollId)}`, variant: 'poll-detail' },
        { slug: 'del', path: `/del/${encodeURIComponent(pollId)}`, variant: 'del' },
        { slug: 'embed', path: `/embed/${encodeURIComponent(pollId)}`, variant: 'embed' },
      ];
      for (const pageDef of retiredPages) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
        });
        const page = await context.newPage();
        const file = join(outDir, `${pageDef.slug}-${vp.name}-${theme}.png`);
        try {
          await capturePage(page, `${baseUrl}${pageDef.path}`, retiredTitle, file);
        } catch {
          await captureRetiredFallback(stylePage, pageDef.variant, theme, vp, file);
        }
        await context.close();
      }
    }
    await styleContext.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
