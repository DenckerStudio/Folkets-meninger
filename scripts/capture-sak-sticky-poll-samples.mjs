/**
 * Playwright screenshots: sak sticky poll line (fiktiv fixture — ingen ekte stemmer).
 * Output: /opt/cursor/artifacts/sak-sticky-*
 */
import { chromium, devices } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = '/opt/cursor/artifacts';
const devRoot = join(process.cwd(), 'app/dev/sak-sticky-poll-capture');
const port = Number(process.env.SCREENSHOT_PORT ?? 3492);
const baseUrl = `http://127.0.0.1:${port}`;

const FIXTURE_SAK_ID = '999001';
const totalsBeforeVote = '{ ja: 0, nei: 0, blank: 0, total: 12 }';

function buildPage({ variant }) {
  const labelText =
    variant === 'after' ? 'Etter (sticky stemmelinje):' : 'Før (uten sticky linje):';
  const sticky =
    variant === 'after'
      ? `
      <SakStickyPollLine
        pollId="fixture-poll-open"
        sakId="${FIXTURE_SAK_ID}"
        initialTotals={${totalsBeforeVote}}
        initialVote={null}
      />`
      : '';

  const bottomPad =
    variant === 'after'
      ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]'
      : '';

  return `'use client';

import { SakStickyPollLine } from '@/components/sak/sak-sticky-poll-line';

export default function Page() {
  return (
    <main className={\`mx-auto min-h-[200vh] max-w-4xl space-y-6 bg-background px-4 py-6 ${bottomPad}\`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixture (fiktiv saksside)</p>
      <h1 className="text-2xl font-bold text-foreground">Skal staten innføre eksempelordningen for fiktiv klimatiltak?</h1>
      <p className="text-sm text-muted-foreground">
        Lang brødtekst for å demonstrere scrolling. ${labelText} ingen ekte data.
      </p>
      {Array.from({ length: 18 }).map((_, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          Avsnitt {i + 1}. Plassholderinnhold for å teste at stemmelinjen følger med når du scroller.
        </p>
      ))}
      ${sticky}
    </main>
  );
}
`;
}

async function writeDevRoutes() {
  await mkdir(join(devRoot, 'for'), { recursive: true });
  await mkdir(join(devRoot, 'etter'), { recursive: true });
  await writeFile(join(devRoot, 'for/page.tsx'), buildPage({ variant: 'before' }));
  await writeFile(join(devRoot, 'etter/page.tsx'), buildPage({ variant: 'after' }));
}

function startServer() {
  const child = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
  });
  return child;
}

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become ready');
}

async function captureVariant(browser, path, label, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(outDir, `sak-sticky-${label}-${viewport.width}x${viewport.height}-top.png`),
    fullPage: false,
  });
  await page.evaluate(() => window.scrollTo({ top: 480, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outDir, `sak-sticky-${label}-${viewport.width}x${viewport.height}-scrolled.png`),
    fullPage: false,
  });
  await page.close();
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await writeDevRoutes();
  execSync('npm run build', { stdio: 'inherit' });

  const server = startServer();
  try {
    await waitForServer(baseUrl);
    const browser = await chromium.launch();
    const viewports = [
      { width: 1440, height: 900 },
      { width: 390, height: 844, ...devices['iPhone 13 Pro'] },
    ];

    for (const vp of viewports) {
      const viewport = vp.viewport ?? { width: vp.width, height: vp.height };
      const context = await browser.newContext({
        viewport,
        ...(vp.isMobile ? { isMobile: true, hasTouch: true } : {}),
      });
      const pageFor = await context.newPage();
      await pageFor.goto(`${baseUrl}/dev/sak-sticky-poll-capture/for`, {
        waitUntil: 'networkidle',
        timeout: 120_000,
      });
      await pageFor.waitForTimeout(400);
      await pageFor.screenshot({
        path: join(outDir, `sak-sticky-main-${viewport.width}-top.png`),
        fullPage: false,
      });
      await pageFor.evaluate(() => window.scrollTo({ top: 520, behavior: 'instant' }));
      await pageFor.waitForTimeout(300);
      await pageFor.screenshot({
        path: join(outDir, `sak-sticky-main-${viewport.width}-scrolled.png`),
        fullPage: false,
      });
      await pageFor.close();

      const pageEtter = await context.newPage();
      await pageEtter.goto(`${baseUrl}/dev/sak-sticky-poll-capture/etter`, {
        waitUntil: 'networkidle',
        timeout: 120_000,
      });
      await pageEtter.waitForTimeout(400);
      await pageEtter.screenshot({
        path: join(outDir, `sak-sticky-branch-${viewport.width}-top.png`),
        fullPage: false,
      });
      await pageEtter.evaluate(() => window.scrollTo({ top: 520, behavior: 'instant' }));
      await pageEtter.waitForTimeout(300);
      await pageEtter.screenshot({
        path: join(outDir, `sak-sticky-branch-${viewport.width}-scrolled.png`),
        fullPage: false,
      });
      await pageEtter.close();
      await context.close();
    }
    await browser.close();
    console.log('Screenshots saved under', outDir);
  } finally {
    server.kill('SIGTERM');
    await rm(devRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});