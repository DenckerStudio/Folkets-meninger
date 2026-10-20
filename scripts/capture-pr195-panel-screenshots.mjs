/**
 * Ephemeral dev preview — writes under app/dev/pr195-capture (deleted after run).
 * Playwright mocks GET /api/admin/content-feedback (local only, not app auth bypass).
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'app/dev/pr195-capture');
const reelsRoot = join(process.cwd(), 'app/dev/pr195-reels-capture');
const storeDir = '/cursor/stores/self/pr195';
const artifactDir = '/opt/cursor/artifacts/pr195';
const sha =
  process.env.SCREENSHOT_SHA?.trim() ||
  execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3460';

const VURDERT_ID = '00000000-0000-4000-8000-000000000003';
const INTERACTIVE_ID = '00000000-0000-4000-8000-000000000004';
const ERROR_ID = '00000000-0000-4000-8000-000000000006';
const SKELETON_ID = '00000000-0000-4000-8000-000000000005';

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
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-vurdert" aria-label="Vurdert">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="${VURDERT_ID}"
          contentSubjectTitle="Skal offentlig sektor kreve grønn innkjøpsstandard?"
          description="Valgfritt, men hjelper oss å forbedre neste generering."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-interactive" aria-label="Interaktiv">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="${INTERACTIVE_ID}"
          contentSubjectTitle="Skal Norge innføre obligatorisk kildesortering?"
          title="Tilbakemelding"
          description="Merker hva som fungerte eller ikke."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-error" aria-label="Feil">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="${ERROR_ID}"
          contentSubjectTitle="Skal avgiften på elbiler økes?"
          title="Tilbakemelding"
          description="Merker hva som fungerte eller ikke."
          onSkip={() => undefined}
        />
      </section>
      <section id="panel-skeleton" aria-label="Skeleton">
        <ContentFeedbackPanel
          contentType="reel"
          contentId="${SKELETON_ID}"
          contentSubjectTitle="Laster eksempelspørsmål …"
          title="Tilbakemelding"
          description="Merker hva som fungerte eller ikke."
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

const reelsPageTsx = `'use client';

import Link from 'next/link';
import { aiSummaryQueueGaveUpKindLabel } from '@/lib/n8n/pipeline-health';
import { routes } from '@/lib/routes';

type GaveUpRow = {
  issueId: string;
  title: string;
  kind: 'mangler_sammendrag' | 'regenerering' | 'tynt_sammendrag';
  attempts: number;
};

function PipelineSection({
  sectionId,
  gaveUp,
}: {
  sectionId: string;
  gaveUp: GaveUpRow[];
}) {
  return (
    <section
      id={sectionId}
      className="rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Bakgrunnsprosess</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Flyten er i rute: sync → embeddings → sammendrag → Reels-utkast.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
        >
          Kjør catch-up
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Ventende dokumentindeks</dt>
          <dd className="font-medium text-foreground">12</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mangler sammendrag</dt>
          <dd className="font-medium text-foreground">3</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tynne sammendrag</dt>
          <dd className="font-medium text-foreground">1</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Utkast som venter</dt>
          <dd className="font-medium text-foreground">2</dd>
        </div>
      </dl>
      {gaveUp.length > 0 ? (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Gitt opp ({gaveUp.length})
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Saker med fem eller flere mislykkede forsøk på sammendrag. Nullstill for å prøve på nytt.
          </p>
          <ul className="mt-3 space-y-2">
            {gaveUp.map((row) => (
              <li
                key={\`\${row.kind}-\${row.issueId}\`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {aiSummaryQueueGaveUpKindLabel(row.kind)} · {row.attempts} forsøk · {row.issueId}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={routes.sak(row.issueId)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                  >
                    Åpne sak
                  </Link>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80"
                  >
                    Nullstill
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function Pr195ReelsPipelineCapturePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      <PipelineSection sectionId="pipeline-gave-up-empty" gaveUp={[]} />
      <PipelineSection
        sectionId="pipeline-gave-up-list"
        gaveUp={[
          {
            issueId: '2025010001',
            title: 'Representantforslag om obligatorisk kildesortering',
            kind: 'regenerering',
            attempts: 5,
          },
        ]}
      />
    </main>
  );
}
`;

function feedbackMockFor(contentId) {
  if (contentId === VURDERT_ID) {
    return {
      feedback: {
        source: 'admin',
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
  const shell = page.locator(`#${panelId}`);
  await shell.waitFor({ state: 'attached', timeout: 60_000 });
  const panel = shell.locator('section').first();
  await panel.waitFor({ state: 'visible', timeout: 60_000 });
  const loading = panel.getByText('Laster tidligere tilbakemelding');
  if (await loading.count()) {
    await loading.waitFor({ state: 'detached', timeout: 30_000 });
  }
  await assertTailwindApplied(page, `#${panelId} section`);
}

async function mockContentFeedbackGet(page, options = {}) {
  const { slowContentId = SKELETON_ID } = options;
  await page.route('**/api/admin/content-feedback**', async (route) => {
    const url = new URL(route.request().url());
    let contentId = url.searchParams.get('content_id') ?? '';
    if (route.request().method() === 'POST') {
      try {
        const body = route.request().postDataJSON();
        if (body && typeof body.content_id === 'string') {
          contentId = body.content_id;
        }
      } catch {
        // ignore
      }
      if (contentId === ERROR_ID) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Kunne ikke lagre' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    if (slowContentId && contentId === slowContentId) {
      await new Promise((r) => setTimeout(r, 30_000));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(feedbackMockFor(contentId)),
    });
  });
}

await mkdir(storeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

if (process.env.SCREENSHOT_SKIP_ROUTE_WRITE !== '1') {
  await rm(root, { recursive: true, force: true });
  await rm(reelsRoot, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  await mkdir(reelsRoot, { recursive: true });
  await writeFile(join(root, 'page.tsx'), pageTsx);
  await writeFile(join(root, 'layout.tsx'), layout);
  await writeFile(join(reelsRoot, 'page.tsx'), reelsPageTsx);
  await writeFile(join(reelsRoot, 'layout.tsx'), layout);
}

const useDev = process.env.SCREENSHOT_USE_DEV === '1';

if (useDev) {
  console.log(`SHA ${sha} — dev server capture (${baseUrl}); waiting for compile …`);
  await new Promise((r) => setTimeout(r, 18_000));
} else if (process.env.SCREENSHOT_SKIP_BUILD !== '1') {
  console.log(`SHA ${sha} — production build with ephemeral route …`);
  execSync('npm run build', { stdio: 'inherit' });
  process.env.SCREENSHOT_RESTART_AFTER_BUILD = '1';
} else {
  console.log(`SHA ${sha} — skip build (SCREENSHOT_SKIP_BUILD); using existing .next output`);
}

const port = new URL(baseUrl).port || '3456';
const healthUrl = `${baseUrl.replace(/\/$/, '')}/`;

async function waitForServer(maxMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.status >= 200 && res.status < 600) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not up at ${baseUrl}`);
}

/** @type {import('node:child_process').ChildProcess | null} */
let serverProc = null;
const shouldStartServer =
  process.env.SCREENSHOT_SKIP_START !== '1' ||
  process.env.SCREENSHOT_RESTART_AFTER_BUILD === '1';
if (shouldStartServer) {
  try {
    execSync(`bash -c 'fuser -k ${port}/tcp 2>/dev/null || true'`);
  } catch {
    // ignore
  }
  serverProc = spawn('npm', ['start'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, HOSTNAME: '127.0.0.1' },
    stdio: 'ignore',
    detached: true,
  });
  serverProc.unref();
  if (process.env.SCREENSHOT_RESTART_AFTER_BUILD === '1') {
    await new Promise((r) => setTimeout(r, 10_000));
  }
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
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await page.waitForTimeout(800);
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

async function shotPanel(
  page,
  panelId,
  name,
  viewportTag,
  { waitReady = true, direct = false } = {},
) {
  if (waitReady && !direct) {
    await waitPanelReady(page, panelId);
  }
  const locator = direct
    ? page.locator(`#${panelId}`)
    : page.locator(`#${panelId}`).locator('section').first();
  await locator.scrollIntoViewIfNeeded();
  const filename = `${sha}-${name}-${viewportTag}.png`;
  for (const path of [join(storeDir, filename), join(artifactDir, filename)]) {
    await locator.screenshot({ path });
  }
  console.log('Wrote', filename);
}

for (const viewport of [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await mockContentFeedbackGet(page);
  await page.goto(`${baseUrl}/dev/pr195-capture`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await page.waitForTimeout(800);
  await shotPanel(page, 'panel-vurdert', 'content-feedback-vurdert', viewport.tag);
  await page.close();
}

for (const viewport of [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await mockContentFeedbackGet(page);
  await page.goto(`${baseUrl}/dev/pr195-capture`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  const panel = page.locator('#panel-interactive');
  await panel.locator('section').first().waitFor({ state: 'visible' });
  await page.locator('#panel-interactive').getByRole('button', { name: 'Godkjenn' }).click();
  await page.locator('#panel-interactive').getByRole('button', { name: 'Lagre tilbakemelding' }).click();
  await page
    .locator('#panel-interactive p.text-emerald-700, #panel-interactive p.dark\\:text-emerald-400')
    .filter({ hasText: 'Takk, tilbakemeldingen er lagret.' })
    .waitFor({ timeout: 15_000 });
  await shotPanel(page, 'panel-interactive', 'content-feedback-success', viewport.tag);
  await page.close();
}

for (const viewport of [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await mockContentFeedbackGet(page);
  await page.goto(`${baseUrl}/dev/pr195-capture`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  const panel = page.locator('#panel-error');
  await panel.locator('section').first().waitFor({ state: 'visible' });
  await page.locator('#panel-error').getByRole('button', { name: 'Godkjenn' }).click();
  await page.locator('#panel-error').getByRole('button', { name: 'Lagre tilbakemelding' }).click();
  await page
    .locator('#panel-error p.text-destructive')
    .filter({ hasText: 'Kunne ikke lagre. Prøv igjen.' })
    .waitFor({ timeout: 15_000 });
  await shotPanel(page, 'panel-error', 'content-feedback-error', viewport.tag);
  await page.close();
}

for (const viewport of [
  { tag: '1280', width: 1280, height: 900 },
  { tag: '390', width: 390, height: 844 },
]) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await mockContentFeedbackGet(page, { slowContentId: SKELETON_ID });
  await page.goto(`${baseUrl}/dev/pr195-capture#panel-skeleton`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  const panel = page.locator('#panel-skeleton');
  await panel.getByText('Laster tidligere tilbakemelding').waitFor({ timeout: 15_000 });
  await shotPanel(page, 'panel-skeleton', 'content-feedback-skeleton', viewport.tag, {
    waitReady: false,
  });
  await page.close();
}

for (const shot of [
  { id: 'pipeline-gave-up-empty', name: 'reels-pipeline-gave-up-empty' },
  { id: 'pipeline-gave-up-list', name: 'reels-pipeline-gave-up-list' },
]) {
  for (const viewport of [
    { tag: '1280', width: 1280, height: 900 },
    { tag: '390', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await page.goto(`${baseUrl}/dev/pr195-reels-capture`, {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await page.waitForTimeout(800);
    await shotPanel(page, shot.id, shot.name, viewport.tag, {
      waitReady: false,
      direct: true,
    });
    await page.close();
  }
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
await rm(reelsRoot, { recursive: true, force: true });
console.log('Done — screenshots in', storeDir);
