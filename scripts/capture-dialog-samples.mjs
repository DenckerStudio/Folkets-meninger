/**
 * Production `next start` screenshots for docs/dialog-samples/.
 * Creates ephemeral app/dev/dialog-samples-capture routes, builds, captures, then removes them.
 *
 * Usage:
 *   SCREENSHOT_LABEL=before node scripts/capture-dialog-samples.mjs
 *   SCREENSHOT_LABEL=after node scripts/capture-dialog-samples.mjs
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const label = (process.env.SCREENSHOT_LABEL ?? 'after').trim();
const outDir = join(process.cwd(), 'docs/dialog-samples', label);
const devRoot = join(process.cwd(), 'app/dev/dialog-samples-capture');
const port = Number(process.env.SCREENSHOT_PORT ?? 3477);
const baseUrl = `http://127.0.0.1:${port}`;

const sharePage = `'use client';

import { useState } from 'react';
import { ShareDialog } from '@/components/share/share-dialog';

export default function DialogSamplesSharePage() {
  const [open, setOpen] = useState(true);
  return (
    <main className="min-h-dvh bg-background p-4">
      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        url="https://www.folkets-meninger.no/dashboard/utforsk"
        title="Skal Norge satse mer på karbonfangst?"
        description="Et eksempel på forhåndsvisning i delingsdialogen."
        previewImageUrl="/opengraph-image"
        overlayTop={false}
      />
      {!open ? (
        <button
          type="button"
          className="rounded-lg border border-border px-4 py-2 text-sm"
          onClick={() => setOpen(true)}
        >
          Åpne delingsdialog
        </button>
      ) : null}
    </main>
  );
}
`;

const statPage = `'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { VURDER_FOCUS_RING } from '@/lib/admin/vurder-interaction-classes';
import { PUBLIC_STATS_DISCLAIMER } from '@/lib/government-stats/snapshot';
import { routes } from '@/lib/routes';
import { cn } from '@/lib/utils';

export default function DialogSamplesStatPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 bg-background p-4 sm:p-8">
      <header>
        <h1 className="text-xl font-bold text-foreground">Statistikk</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin-visning (eksempel)</p>
      </header>
      <p
        role="status"
        aria-live="polite"
        className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
      >
        Statistikken er ikke klar i databasen ennå. En administrator må kjøre den ventende databasemigrasjonen før tallene vises her.
      </p>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground">
          {PUBLIC_STATS_DISCLAIMER}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground hover:bg-brand/90',
              VURDER_FOCUS_RING,
            )}
          >
            <Download className="h-4 w-4" />
            Last ned CSV
          </button>
          <a
            href="/api/admin/government-stats/export?format=json&limit=200"
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50',
              VURDER_FOCUS_RING,
            )}
          >
            JSON (krever innlogging)
          </a>
          <Link
            href={routes.innsikt}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50',
              VURDER_FOCUS_RING,
            )}
          >
            Offentlig innsikt-side →
          </Link>
        </div>
      </div>
    </main>
  );
}
`;

async function writeDevRoutes() {
  await mkdir(join(devRoot, 'share'), { recursive: true });
  await mkdir(join(devRoot, 'statistikk'), { recursive: true });
  await writeFile(join(devRoot, 'share/page.tsx'), sharePage);
  await writeFile(join(devRoot, 'statistikk/page.tsx'), statPage);
}

async function removeDevRoutes() {
  await rm(devRoot, { recursive: true, force: true });
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

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
  const shots = [
    { path: '/dev/dialog-samples-capture/share', name: 'share-dialog', width: 360, colorScheme: 'light' },
    { path: '/dev/dialog-samples-capture/share', name: 'share-dialog', width: 1280, colorScheme: 'dark' },
    { path: '/dev/dialog-samples-capture/statistikk', name: 'admin-statistikk', width: 360, colorScheme: 'light' },
    { path: '/dev/dialog-samples-capture/statistikk', name: 'admin-statistikk', width: 1280, colorScheme: 'dark' },
  ];

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.width <= 400 ? 780 : 900 },
      colorScheme: shot.colorScheme,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
    if (shot.path.includes('share')) {
      await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 15_000 });
    } else {
      await page.getByRole('heading', { name: 'Statistikk' }).waitFor();
    }
    await page.waitForTimeout(400);
    const fileName = `${shot.name}-${shot.width <= 400 ? '360-light' : 'desktop-dark'}.png`;
    await page.screenshot({ path: join(outDir, fileName), fullPage: shot.path.includes('statistikk') });
    await context.close();
  }

  await browser.close();
}

async function main() {
  await writeDevRoutes();
  try {
    run('npm run build');
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
      console.log(`Saved screenshots under docs/dialog-samples/${label}/`);
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
    await removeDevRoutes();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
