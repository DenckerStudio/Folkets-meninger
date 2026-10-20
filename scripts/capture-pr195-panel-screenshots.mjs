/**
 * Ephemeral dev preview — writes under app/dev/pr195-capture (deleted after run).
 * Playwright mocks GET /api/admin/content-feedback (local only, not app auth bypass).
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'app/dev/pr195-capture');
const storeDir = '/cursor/stores/self/pr195';
const artifactDir = '/opt/cursor/artifacts/pr195';
const sha =
  process.env.SCREENSHOT_SHA?.trim() ||
  execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3456';

const VURDERT_ID = '00000000-0000-4000-8000-000000000003';

const pageTsx = `'use client';

import { ContentFeedbackPanel } from '@/components/admin/content-feedback-panel';

export default function Pr195CapturePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      <section id="panel-approve" aria-label="Godkjenn">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="00000000-0000-4000-8000-000000000001"
          lockedVerdict="approve"
          contentSubjectTitle="Bør Norge forby salg av engangsplast?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-reject" aria-label="Avvis">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="00000000-0000-4000-8000-000000000002"
          lockedVerdict="reject"
          contentSubjectTitle="Bør staten øke støtten til næringslivet i distriktene?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-vurdert" aria-label="Vurdert">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="${VURDERT_ID}"
          contentSubjectTitle="Skal offentlig sektor kreve grønn innkjøpsstandard?"
          title="Hva fungerte med utkastet?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
    </main>
  );
}
`;

const layout = `export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
`;

function feedbackMockFor(contentId) {
  if (contentId === VURDERT_ID) {
    return {
      feedback: {
        verdict: 'approve',
        aspects: { title: '+', language: '+' },
        reason_tags: [],
        note: 'Godt formulert spørsmål.',
      },
    };
  }
  return { feedback: null };
}

async function assertTailwindApplied(page, selector) {
  const styles = await page.locator(selector).evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      borderRadius: cs.borderRadius,
      borderWidth: cs.borderTopWidth,
    };
  });
  const looksStyled =
    styles.borderRadius !== '0px' &&
    styles.borderWidth !== '0px' &&
    !/^times/i.test(styles.fontFamily);
  if (!looksStyled) {
    throw new Error(
      `Tailwind ser ikke aktiv på ${selector}: ${JSON.stringify(styles)}`,
    );
  }
}

async function waitPanelReady(page, panelId) {
  const panel = page.locator(`#${panelId}`);
  await panel.waitFor({ state: 'visible', timeout: 60_000 });
  await panel.getByText('Laster tidligere tilbakemelding').waitFor({
    state: 'detached',
    timeout: 30_000,
  });
  await assertTailwindApplied(page, `#${panelId} section`);
}

async function mockContentFeedbackGet(page) {
  await page.route('**/api/admin/content-feedback**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const contentId = url.searchParams.get('content_id') ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(feedbackMockFor(contentId)),
    });
  });
}

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await writeFile(join(root, 'page.tsx'), pageTsx);
await writeFile(join(root, 'layout.tsx'), layout);
await mkdir(storeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

if (process.env.SCREENSHOT_SKIP_BUILD !== '1') {
  console.log(`SHA ${sha} — production build with ephemeral route …`);
  execSync('npm run build', { stdio: 'inherit' });
} else {
  console.log(`SHA ${sha} — skip build (SCREENSHOT_SKIP_BUILD); waiting for dev HMR …`);
  await new Promise((r) => setTimeout(r, 15_000));
}

const port = new URL(baseUrl).port || '3456';
const healthUrl = `${baseUrl.replace(/\/$/, '')}/`;

async function waitForServer(maxMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not up at ${baseUrl}`);
}

/** @type {import('node:child_process').ChildProcess | null} */
let serverProc = null;
if (process.env.SCREENSHOT_SKIP_START !== '1') {
  serverProc = spawn('npm', ['start'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, HOSTNAME: '127.0.0.1' },
    stdio: 'ignore',
    detached: true,
  });
  serverProc.unref();
}
await waitForServer();
console.log(`Server ready on ${baseUrl}`);

const browser = await chromium.launch();
const shots = [
  { id: 'panel-approve', name: 'content-feedback-approve' },
  { id: 'panel-reject', name: 'content-feedback-reject' },
];

for (const viewport of [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await mockContentFeedbackGet(page);
  await page.goto(`${baseUrl}/dev/pr195-capture`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  for (const shot of shots) {
    await waitPanelReady(page, shot.id);
    const locator = page.locator(`#${shot.id}`);
    await locator.scrollIntoViewIfNeeded();
    const filename = `${sha}-${shot.name}-${viewport.tag}.png`;
    const paths = [join(storeDir, filename), join(artifactDir, filename)];
    for (const path of paths) {
      await locator.screenshot({ path });
    }
    console.log('Wrote', filename);
  }
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await mockContentFeedbackGet(page);
  await page.goto(`${baseUrl}/dev/pr195-capture`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await waitPanelReady(page, 'panel-vurdert');
  await page.getByText('Vurdert', { exact: true }).waitFor({ timeout: 10_000 });
  const locator = page.locator('#panel-vurdert');
  const filename = `${sha}-content-feedback-vurdert-1280.png`;
  for (const path of [join(storeDir, filename), join(artifactDir, filename)]) {
    await locator.screenshot({ path });
  }
  console.log('Wrote', filename);
  await page.close();
}

await browser.close();
if (serverProc?.pid) {
  try {
    process.kill(serverProc.pid, 'SIGTERM');
  } catch {
    // already stopped
  }
}
await rm(root, { recursive: true, force: true });
console.log('Done — screenshots in', storeDir);
