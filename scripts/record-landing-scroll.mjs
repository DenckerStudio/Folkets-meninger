/**
 * Record slow full-page scroll for FØR/ETTER landing comparison.
 * Usage: node scripts/record-landing-scroll.mjs --url=URL --label=LABEL --viewport=1440x900
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = '/opt/cursor/artifacts/landing-scroll-raw';
mkdirSync(outDir, { recursive: true });

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, '').split('=');
      return [key, rest.join('=') || 'true'];
    }),
  );
  const viewport = String(args.viewport ?? '1440x900').split('x').map(Number);
  return {
    url: args.url ?? 'http://127.0.0.1:3000/',
    label: args.label ?? 'capture',
    width: viewport[0] ?? 1440,
    height: viewport[1] ?? 900,
    mobile: args.mobile === 'true',
  };
}

async function slowScroll(page) {
  await page.waitForTimeout(400);
  const height = await page.evaluate(() => document.body.scrollHeight);
  const steps = 28;
  for (let i = 0; i <= steps; i += 1) {
    const y = Math.round((height * i) / steps);
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: 'instant' }), y);
    await page.waitForTimeout(450);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(800);
}

async function main() {
  const opts = parseArgs();
  const device = opts.mobile
    ? { ...devices['iPhone 13 Pro'], viewport: { width: 390, height: 844 } }
    : { viewport: { width: opts.width, height: opts.height } };

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...device,
    recordVideo: {
      dir: outDir,
      size: device.viewport,
    },
  });
  const page = await context.newPage();
  await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: join('/opt/cursor/artifacts', `hero-${opts.mobile ? 'mobile' : 'desktop'}-${opts.label}.png`),
    fullPage: false,
  });
  await slowScroll(page, opts.url);
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const path = await video.path();
    const target = join(outDir, `${opts.label}-${opts.mobile ? 'mobile' : 'desktop'}.webm`);
    const { renameSync } = await import('node:fs');
    renameSync(path, target);
    console.log('saved', target);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});