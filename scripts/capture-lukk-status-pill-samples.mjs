/**
 * Ephemeral dev route + `next start` screenshots for «Lukk status» pill states.
 * Writes PNGs to docs/dialog-samples/after/.
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'docs/dialog-samples/after');
const devRoot = join(process.cwd(), 'app/dev/lukk-status-pill-capture');
const port = Number(process.env.SCREENSHOT_PORT ?? 3478);
const baseUrl = `http://127.0.0.1:${port}`;

const pageTsx = `'use client';

import { CheckCircle2, X } from 'lucide-react';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { cn } from '@/lib/utils';

const STATUS_PILL_DISMISS_BUTTON =
  'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full after:absolute after:-inset-2.5 after:content-[""]';

export default function LukkStatusPillCapturePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-8">
      <span
        id="status-pill"
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
        Utkast klart
        <button
          type="button"
          className={cn(STATUS_PILL_DISMISS_BUTTON, 'hover:bg-emerald-500/10', VURDER_FOCUS_RING)}
          aria-label="Lukk status"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    </main>
  );
}
`;

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not become ready');
}

async function capture() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const schemes = [
    { colorScheme: 'light', suffix: '360-light' },
    { colorScheme: 'dark', suffix: '360-dark' },
  ];

  for (const { colorScheme, suffix } of schemes) {
    const context = await browser.newContext({
      viewport: { width: 360, height: 320 },
      colorScheme,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/dev/lukk-status-pill-capture`, { waitUntil: 'networkidle' });
    const pill = page.locator('#status-pill');
    const button = page.getByRole('button', { name: 'Lukk status' });

    await pill.screenshot({
      path: join(outDir, `lukk-status-pill-rest-${suffix}.png`),
    });

    await button.hover();
    await page.waitForTimeout(150);
    await pill.screenshot({
      path: join(outDir, `lukk-status-pill-hover-${suffix}.png`),
    });

    await page.mouse.move(0, 0);
    await button.focus();
    await page.waitForTimeout(150);
    await pill.screenshot({
      path: join(outDir, `lukk-status-pill-focus-${suffix}.png`),
    });

    await context.close();
  }

  await browser.close();
}

async function main() {
  await mkdir(devRoot, { recursive: true });
  await writeFile(join(devRoot, 'page.tsx'), pageTsx);
  try {
    execSync('npm run build', { stdio: 'inherit' });
    const child = spawn('npm', ['run', 'start', '--', '-p', String(port)], {
      cwd: process.cwd(),
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    child.unref();
    try {
      await waitForServer();
      await capture();
      console.log('Saved lukk-status-pill PNGs under docs/dialog-samples/after/');
    } finally {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        try {
          process.kill(child.pid, 'SIGTERM');
        } catch {
          // ignore
        }
      }
    }
  } finally {
    await rm(devRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
