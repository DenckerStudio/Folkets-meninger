/**
 * Ephemeral dev preview — writes under app/dev/pr195-capture (deleted after run).
 * Not part of the repo; mock panels only (no auth).
 */
import { chromium } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'app/dev/pr195-capture');
const storeDir = '/cursor/stores/self/pr195';
const artifactDir = '/opt/cursor/artifacts/pr195';
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3000';

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
    </main>
  );
}
`;

const layout = `export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
`;

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await writeFile(join(root, 'page.tsx'), pageTsx);
await writeFile(join(root, 'layout.tsx'), layout);
await mkdir(storeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

console.log('Waiting for Next.js to pick up ephemeral route …');
await new Promise((r) => setTimeout(r, 12_000));

const browser = await chromium.launch();
const shots = [
  { id: 'panel-approve', name: 'content-feedback-approve' },
  { id: 'panel-reject', name: 'content-feedback-reject' },
];

for (const viewport of [
  { tag: 'desktop', width: 1280, height: 900 },
  { tag: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(`${baseUrl}/dev/pr195-capture`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#panel-approve', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  for (const shot of shots) {
    const locator = page.locator(`#${shot.id}`);
    await locator.scrollIntoViewIfNeeded();
    const paths = [
      join(storeDir, `${shot.name}-${viewport.tag}.png`),
      join(artifactDir, `${shot.name}-${viewport.tag}.png`),
    ];
    for (const path of paths) {
      await locator.screenshot({ path });
    }
  }
  await page.close();
}

await browser.close();
await rm(root, { recursive: true, force: true });
console.log('Screenshots saved to', storeDir, 'and', artifactDir);
