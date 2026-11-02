/**
 * Screenshots for docs/stortinget-poll-admin/ (fictional fixture data only).
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'docs/stortinget-poll-admin');
const devRoot = join(process.cwd(), 'app/dev/stortinget-poll-admin-capture');
const port = Number(process.env.SCREENSHOT_PORT ?? 3488);
const baseUrl = `http://127.0.0.1:${port}`;

const FIXTURE = {
  sakId: '999001',
  sakTitle: 'Skal staten innføre eksempelordningen for fiktiv klimatiltak?',
  neutralSummary:
    'Dette er fiktiv nøytral ingress brukt kun til skjermbilder. Den beskriver ikke en ekte sak.',
  stortingetUrl:
    'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=999001',
};

const sakPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function StortingetPollAdminCaptureSakPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl space-y-6 bg-background p-4 sm:p-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixture (fiktiv)</p>
        <h1 className="text-2xl font-bold text-foreground">${FIXTURE.sakTitle.replace(/'/g, "\\'")}</h1>
      </header>
      <StortingetPollAdminSection
        sakId="${FIXTURE.sakId}"
        sakTitle="${FIXTURE.sakTitle.replace(/'/g, "\\'")}"
        defaultNeutralSummary="${FIXTURE.neutralSummary.replace(/'/g, "\\'")}"
        stortingetPageUrl="${FIXTURE.stortingetUrl}"
        existingPoll={null}
      />
    </main>
  );
}
`;

const dialogPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function StortingetPollAdminCaptureDialogPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-background p-4 sm:p-8">
      <StortingetPollAdminSection
        sakId="${FIXTURE.sakId}"
        sakTitle="${FIXTURE.sakTitle.replace(/'/g, "\\'")}"
        defaultNeutralSummary="${FIXTURE.neutralSummary.replace(/'/g, "\\'")}"
        stortingetPageUrl="${FIXTURE.stortingetUrl}"
        existingPoll={null}
        captureDialogOpen
      />
    </main>
  );
}
`;

async function writeDevRoutes() {
  await mkdir(join(devRoot, 'sak'), { recursive: true });
  await mkdir(join(devRoot, 'dialog'), { recursive: true });
  await writeFile(join(devRoot, 'sak/page.tsx'), sakPage);
  await writeFile(join(devRoot, 'dialog/page.tsx'), dialogPage);
}

async function removeDevRoutes() {
  await rm(devRoot, { recursive: true, force: true });
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: 'inherit', ...opts });
}

async function waitForServer() {
  for (let i = 0; i < 90; i += 1) {
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
    {
      path: '/dev/stortinget-poll-admin-capture/sak',
      name: 'sak-admin-knapp',
      width: 360,
      colorScheme: 'light',
      waitDialog: false,
    },
    {
      path: '/dev/stortinget-poll-admin-capture/sak',
      name: 'sak-admin-knapp',
      width: 1280,
      colorScheme: 'light',
      waitDialog: false,
    },
    {
      path: '/dev/stortinget-poll-admin-capture/dialog',
      name: 'publiser-dialog',
      width: 360,
      colorScheme: 'light',
      waitDialog: true,
    },
    {
      path: '/dev/stortinget-poll-admin-capture/dialog',
      name: 'publiser-dialog',
      width: 1280,
      colorScheme: 'dark',
      waitDialog: true,
    },
  ];

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.width <= 400 ? 820 : 920 },
      colorScheme: shot.colorScheme,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
    if (shot.waitDialog) {
      await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 20_000 });
    } else {
      await page.getByRole('button', { name: 'Opprett avstemning' }).waitFor();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const suffix =
      shot.width <= 400
        ? `${shot.colorScheme}-360`
        : `${shot.colorScheme}-1280`;
    await page.screenshot({
      path: join(outDir, `${shot.name}-${suffix}.png`),
      fullPage: true,
    });
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
      console.log(`Saved screenshots under ${outDir}`);
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
