/**
 * Screenshots for docs/stortinget-poll-admin/ (fictional fixture data only).
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'docs/stortinget-poll-admin');
const devRoot = join(process.cwd(), 'app/dev/stortinget-poll-admin-capture');
const port = Number(process.env.SCREENSHOT_PORT ?? 3489);
const baseUrl = `http://127.0.0.1:${port}`;

const FIXTURE = {
  sakId: '999001',
  sakTitle: 'Skal staten innføre eksempelordningen for fiktiv klimatiltak?',
  neutralSummary:
    'Dette er fiktiv nøytral ingress brukt kun til skjermbilder. Den beskriver ikke en ekte sak.',
  stortingetUrl:
    'https://www.stortinget.no/no/Saker-og-publikasjoner/Saker/Sak/?p=999001',
};

const esc = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const adminStateCreate = 'adminState={{ kind: "create" }}';
const adminStateEditable = `adminState={{
          kind: 'editable',
          poll: {
            id: 'fixture-poll-uuid',
            title: '${esc(FIXTURE.sakTitle)}',
            neutralSummary: '${esc(FIXTURE.neutralSummary)}',
            closesAt: '2020-06-01T10:00:00.000Z',
          },
        }}`;
const adminStateBlocked = 'captureAdminState={{ kind: "blocked_system_poll" }} adminState={{ kind: "create" }}';

const sakHeader = `
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixture (fiktiv)</p>
        <h1 className="text-2xl font-bold text-foreground">${esc(FIXTURE.sakTitle)}</h1>
      </header>`;

const sectionProps = (extra = '') => `
        sakId="${FIXTURE.sakId}"
        sakTitle="${esc(FIXTURE.sakTitle)}"
        defaultNeutralSummary="${esc(FIXTURE.neutralSummary)}"
        stortingetPageUrl="${FIXTURE.stortingetUrl}"
        ${extra}`;

const sakDialogPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl space-y-6 bg-background p-4 sm:p-8">
      ${sakHeader}
      <StortingetPollAdminSection
        ${sectionProps(`${adminStateCreate}\n        captureDialogOpen`)}
      />
    </main>
  );
}
`;

const sakRedigerPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl space-y-6 bg-background p-4 sm:p-8">
      ${sakHeader}
      <StortingetPollAdminSection
        ${sectionProps(adminStateEditable)}
      />
    </main>
  );
}
`;

const dialogConfirmPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-background p-4 sm:p-8">
      <StortingetPollAdminSection
        ${sectionProps(`${adminStateCreate}\n        captureDialogOpen\n        captureDialogStep="confirm"`)}
      />
    </main>
  );
}
`;

const dialogFeilPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-background p-4 sm:p-8">
      <StortingetPollAdminSection
        ${sectionProps(
          `${adminStateCreate}\n        captureDialogOpen\n        captureFieldError="Sluttidspunktet må ligge i fremtiden. Velg en senere dato og klokkeslett (Europe/Oslo)."`,
        )}
      />
    </main>
  );
}
`;

const dialogLastPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-background p-4 sm:p-8">
      <StortingetPollAdminSection
        ${sectionProps(`${adminStateCreate}\n        captureDialogOpen\n        capturePending`)}
      />
    </main>
  );
}
`;

const dialogRedigerPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-background p-4 sm:p-8">
      <StortingetPollAdminSection
        ${sectionProps(`${adminStateEditable}\n        captureEditDialogOpen`)}
      />
    </main>
  );
}
`;

const sakBlokkertPage = `'use client';

import { StortingetPollAdminSection } from '@/components/sak/stortinget-poll-admin-section';

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-4xl space-y-6 bg-background p-4 sm:p-8">
      ${sakHeader}
      <StortingetPollAdminSection
        ${sectionProps(adminStateBlocked)}
      />
    </main>
  );
}
`;

const pollListPage = (votingOpen) => `'use client';

import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';
import { PollCard } from '@/components/polls/poll-card';
import {
  buildCaptureStortingetPollFixture,
  CAPTURE_POLL_TOTALS,
} from '@/lib/polls/stortinget-poll-capture-fixture';

export default function Page() {
  const poll = buildCaptureStortingetPollFixture({ votingOpen: ${votingOpen} });
  return (
    <DashboardPage>
      <PageHeader title="Avstemninger" description="Fixture (fiktiv)" />
      <div className="grid gap-3 sm:gap-4">
        <PollCard poll={poll} totals={CAPTURE_POLL_TOTALS} />
      </div>
    </DashboardPage>
  );
}
`;

const pollDetailPage = (votingOpen) => `'use client';

import { DashboardPage } from '@/components/dashboard/dashboard-page';
import { PageHeader } from '@/components/page-header';
import { PollBallot } from '@/components/polls/poll-ballot';
import { PollResultView } from '@/components/polls/poll-result-view';
import { formatPollDisplayTitle } from '@/lib/polls/display-title';
import { isPollVotingOpen } from '@/lib/polls/format';
import {
  buildCaptureStortingetPollFixture,
  CAPTURE_POLL_TOTALS,
} from '@/lib/polls/stortinget-poll-capture-fixture';

export default function Page() {
  const poll = buildCaptureStortingetPollFixture({ votingOpen: ${votingOpen} });
  const votingOpenNow = isPollVotingOpen(poll);
  return (
    <DashboardPage className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fixture (fiktiv)</p>
      <PageHeader title={formatPollDisplayTitle(poll.title)} />
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{poll.neutralSummary}</p>
      <PollBallot
        pollId={poll.id}
        votingOpen={votingOpenNow}
        initialTotals={CAPTURE_POLL_TOTALS}
        initialVote={null}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Resultat per fylke</h2>
        <PollResultView byFylke={[]} />
      </section>
    </DashboardPage>
  );
}
`;

async function writeDevRoutes() {
  const pages = [
    ['sak-dialog', sakDialogPage],
    ['sak-rediger', sakRedigerPage],
    ['dialog-bekreft', dialogConfirmPage],
    ['dialog-feil', dialogFeilPage],
    ['dialog-last', dialogLastPage],
    ['dialog-rediger', dialogRedigerPage],
    ['sak-blokkert', sakBlokkertPage],
    ['poll-liste-apen', pollListPage(true)],
    ['poll-liste-avsluttet', pollListPage(false)],
    ['poll-detalj-apen', pollDetailPage(true)],
    ['poll-detalj-avsluttet', pollDetailPage(false)],
  ];
  await rm(devRoot, { recursive: true, force: true });
  for (const [name, source] of pages) {
    const dir = join(devRoot, name);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'page.tsx'), source);
  }
}

async function removeDevRoutes() {
  await rm(devRoot, { recursive: true, force: true });
}

async function cleanOldPngs() {
  const entries = await readdir(outDir).catch(() => []);
  await Promise.all(
    entries.filter((name) => name.endsWith('.png')).map((name) => unlink(join(outDir, name))),
  );
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

/** @type {Array<{ path: string; file: string; width: number; colorScheme: 'light' | 'dark'; wait?: (page: import('playwright').Page) => Promise<void> }>} */
const shots = [
  {
    path: '/dev/stortinget-poll-admin-capture/sak-dialog',
    file: 'sak-dialog-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-dialog',
    file: 'sak-dialog-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-dialog',
    file: 'sak-dialog-dark-360.png',
    width: 360,
    colorScheme: 'dark',
    wait: async (page) => {
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-dialog',
    file: 'sak-dialog-dark-1280.png',
    width: 1280,
    colorScheme: 'dark',
    wait: async (page) => {
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/dialog-bekreft',
    file: 'dialog-bekreft-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Publisere nå?' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/dialog-feil',
    file: 'dialog-feil-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByText('Sluttidspunktet må ligge i fremtiden').waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/dialog-last',
    file: 'dialog-last-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-blokkert',
    file: 'sak-blokkert-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Saken har en avviklet systemavstemning' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-blokkert',
    file: 'sak-blokkert-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Saken har en avviklet systemavstemning' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-blokkert',
    file: 'sak-blokkert-dark-1280.png',
    width: 1280,
    colorScheme: 'dark',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Saken har en avviklet systemavstemning' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/sak-rediger',
    file: 'sak-rediger-light-360.png',
    width: 360,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('button', { name: 'Rediger avstemning' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/dialog-rediger',
    file: 'dialog-rediger-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Rediger avstemning' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/poll-liste-apen',
    file: 'avstemning-liste-apen-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByText('Stenger', { exact: false }).first().waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/poll-detalj-apen',
    file: 'avstemning-detalj-apen-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByRole('heading', { name: 'Hva mener du?' }).waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/poll-liste-avsluttet',
    file: 'avstemning-liste-avsluttet-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByText('Avstemningen er avsluttet').first().waitFor();
    },
  },
  {
    path: '/dev/stortinget-poll-admin-capture/poll-detalj-avsluttet',
    file: 'avstemning-detalj-avsluttet-light-1280.png',
    width: 1280,
    colorScheme: 'light',
    wait: async (page) => {
      await page.getByText('Avstemningen er avsluttet').first().waitFor();
    },
  },
];

async function capture() {
  await mkdir(outDir, { recursive: true });
  await cleanOldPngs();
  const browser = await chromium.launch();

  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.width <= 400 ? 860 : 960 },
      colorScheme: shot.colorScheme,
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });
    await shot.wait(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(outDir, shot.file), fullPage: true });
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
